export const CHURCH_TIME_ZONE = "America/Sao_Paulo";
export const WEEKLY_SERVICES = [
  { key: "sundayMorning", weekday: 0, time: "09:00", name: "Culto de domingo · manhã", label: "Todos os domingos · 09h" },
  { key: "sunday", weekday: 0, time: "18:00", name: "Culto de domingo", label: "Todos os domingos · 18h" },
  { key: "wednesday", weekday: 3, time: "20:00", name: "Culto de quarta-feira", label: "Todas as quartas-feiras · 20h" },
] as const;
export type WeeklyServiceKey = typeof WEEKLY_SERVICES[number]["key"];
export type WeeklyServiceConfig = { key: WeeklyServiceKey; name: string; location: string | null; bannerImageUrl: string | null };
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: CHURCH_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function parts(date: Date) { return Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value])); }
export function churchDateKey(date: Date) { const p = parts(date); return `${p.year}-${p.month}-${p.day}`; }
export function churchDateTime(date: string, time: string): Date {
  const local = Date.parse(`${date}T${time}:00Z`);
  let result = local;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(result));
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    result += local - wall;
  }
  return new Date(result);
}
export function churchAgendaRange(range: "today" | "week" | "month", now = new Date()) {
  const calendar = new Date(`${churchDateKey(now)}T00:00:00Z`);
  if (range === "week") calendar.setUTCDate(calendar.getUTCDate() - calendar.getUTCDay());
  if (range === "month") calendar.setUTCDate(1);
  const fromKey = calendar.toISOString().slice(0, 10);
  if (range === "month") calendar.setUTCMonth(calendar.getUTCMonth() + 1);
  else calendar.setUTCDate(calendar.getUTCDate() + (range === "week" ? 7 : 1));
  return { from: churchDateTime(fromKey, "00:00"), to: churchDateTime(calendar.toISOString().slice(0, 10), "00:00") };
}
export function weeklyOccurrences(from: Date, to: Date, configs: WeeklyServiceConfig[]) {
  const result: Array<{ id: string; name: string; startsAt: Date; location: string | null; bannerImageUrl: string | null }> = [];
  const day = new Date(`${churchDateKey(from)}T00:00:00Z`);
  while (day.getTime() < to.getTime()) {
    const dateKey = day.toISOString().slice(0, 10);
    const services = WEEKLY_SERVICES.filter(service => service.weekday === day.getUTCDay());
    for (const service of services) {
      const config = configs.find(config => config.key === service.key);
      const startsAt = churchDateTime(dateKey, service.time);
      if (config && startsAt >= from && startsAt < to) result.push({ id: `viva-weekly-${service.key}-${dateKey}`, name: config.name, startsAt, location: config.location, bannerImageUrl: config.bannerImageUrl });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}
