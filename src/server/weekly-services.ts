import { z } from "zod";
import { prisma } from "@/server/db";
import { WEEKLY_SERVICES, weeklyOccurrences, type WeeklyServiceConfig } from "@/lib/weekly-services";

const configSchema = z.object({ name: z.string().trim().min(2).max(150), location: z.string().max(200).nullable(), bannerImageUrl: z.string().nullable() });
const settingKey = (key: string) => `weekly-service:${key}`;
export async function getWeeklyServices(): Promise<WeeklyServiceConfig[]> {
  const stored = await prisma.appSetting.findMany({ where: { key: { in: WEEKLY_SERVICES.map(service => settingKey(service.key)) } } });
  return WEEKLY_SERVICES.map(service => {
    const row = stored.find(row => row.key === settingKey(service.key));
    let config: z.infer<typeof configSchema> | undefined;
    try { if (row) config = configSchema.parse(JSON.parse(row.value)); } catch { /* Defaults preserve the fixed calendar. */ }
    return { key: service.key, name: config?.name ?? service.name, location: config?.location ?? null, bannerImageUrl: config?.bannerImageUrl ?? null };
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
    const existing = await prisma.event.findMany({ where: { type: "SERVICE", public: true, startsAt: { gte: from, lt: to } }, select: { startsAt: true } });
    const occupied = new Set(existing.map(event => event.startsAt.toISOString()));
    const occurrences = weeklyOccurrences(from, to, configs).filter(event => !occupied.has(event.startsAt.toISOString()));
    if (occurrences.length) await prisma.event.createMany({ data: occurrences.map(event => ({ ...event, type: "SERVICE" as const, public: true, ministriesInvolved: [] })), skipDuplicates: true });
    readyUntil = Date.now() + 60_000;
  })();
  try { await pending; } finally { pending = undefined; }
}
export async function updateWeeklyService(config: WeeklyServiceConfig) {
  const parsed = configSchema.parse(config);
  if (!WEEKLY_SERVICES.some(service => service.key === config.key)) throw new Error("Culto fixo inválido.");
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: settingKey(config.key) }, create: { key: settingKey(config.key), value: JSON.stringify(parsed) }, update: { value: JSON.stringify(parsed) } }),
    prisma.event.updateMany({ where: { id: { startsWith: `viva-weekly-${config.key}-` }, startsAt: { gte: new Date() } }, data: parsed }),
  ]);
  readyUntil = 0;
  await ensureWeeklyServices();
}
