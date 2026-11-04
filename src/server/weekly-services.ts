import { syncStaffingSchedule } from "@/server/staffing";
import { z } from "zod";
import { prisma } from "@/server/db";
import { WEEKLY_SERVICES, weeklyOccurrences, type WeeklyServiceConfig } from "@/lib/weekly-services";

const configSchema = z.object({ name: z.string().trim().min(2).max(150), location: z.string().max(200).nullable(), bannerImageUrl: z.string().nullable() });
const settingKey = (key: string) => `weekly-service:${key}`;
export async function getWeeklyServices(): Promise<WeeklyServiceConfig[]> {
  const stored = await prisma.appSetting.findMany({ where: { key: { in: WEEKLY_SERVICES.map(service => settingKey(service.key)) } } });
  return WEEKLY_SERVICES.filter(service => service.key === service.configKey).map(service => {
    // Prefer the existing Sunday configuration and artwork. Use a legacy morning
    // setting only when no shared Sunday setting has ever been saved.
    const shared = stored.find(row => row.key === settingKey(service.configKey));
    const row = shared ?? (service.configKey === "sunday" ? stored.find(row => row.key === settingKey("sundayMorning")) : undefined);
    let config: z.infer<typeof configSchema> | undefined;
    try { if (row) config = configSchema.parse(JSON.parse(row.value)); } catch { /* Defaults preserve the fixed calendar. */ }
    return { key: service.configKey, name: shared ? config?.name ?? service.name : service.name, location: config?.location ?? null, bannerImageUrl: config?.bannerImageUrl ?? null };
  });
}
let readyUntil = 0;
let pending: Promise<void> | undefined;
/** Materialize a rolling window as real events: no end date, cron dependency or duplicate IDs. */
export async function ensureWeeklyServices(now = new Date()) {
  if (Date.now() < readyUntil) return;
  if (pending) return pending;
  pending = (async () => {
    const configs = await getWeeklyServices();
    const from = new Date(now.getTime() - 3 * 86400000);
    const to = new Date(now.getTime() + 100 * 86400000);
    const existing = await prisma.event.findMany({ where: { type: "SERVICE", public: true, startsAt: { gte: from, lt: to } }, select: { id: true, startsAt: true, name: true, location: true, bannerImageUrl: true } });
    const occupied = new Set(existing.map(event => event.startsAt.toISOString()));
    const occurrences = weeklyOccurrences(from, to, configs).filter(event => !occupied.has(event.startsAt.toISOString()));
    if (occurrences.length) await prisma.event.createMany({ data: occurrences.map(event => ({ ...event, type: "SERVICE" as const, public: true, ministriesInvolved: [] })), skipDuplicates: true });
    for (const event of occurrences) await syncStaffingSchedule({ ...event, type: "SERVICE", endsAt: null }, now);
    // Reconcile already-created future occurrences when series are grouped or
    // their shared artwork changes; preserve IDs, past services and manual events.
    for (const config of configs) {
      const prefixes = WEEKLY_SERVICES.filter(service => service.configKey === config.key).map(service => `viva-weekly-${service.key}-`);
      const changedIds = existing.filter(event => event.startsAt >= now && prefixes.some(prefix => event.id.startsWith(prefix)) &&
        (event.name !== config.name || event.location !== config.location || event.bannerImageUrl !== config.bannerImageUrl)).map(event => event.id);
      if (changedIds.length) await prisma.event.updateMany({ where: { id: { in: changedIds } }, data: { name: config.name, location: config.location, bannerImageUrl: config.bannerImageUrl } });
    }
    readyUntil = Date.now() + 60_000;
  })();
  try { await pending; } finally { pending = undefined; }
}
export async function updateWeeklyService(config: WeeklyServiceConfig) {
  const parsed = configSchema.parse(config);
  const rules = WEEKLY_SERVICES.filter(service => service.configKey === config.key);
  if (!rules.length) throw new Error("Culto fixo inválido.");
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: settingKey(config.key) }, create: { key: settingKey(config.key), value: JSON.stringify(parsed) }, update: { value: JSON.stringify(parsed) } }),
    prisma.event.updateMany({ where: { OR: rules.map(service => ({ id: { startsWith: `viva-weekly-${service.key}-` } })), startsAt: { gte: new Date() } }, data: parsed }),
  ]);
  if (pending) await pending;
  readyUntil = 0;
  await ensureWeeklyServices();
}
