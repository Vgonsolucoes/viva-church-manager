import { churchDateKey, churchDateTime } from "@/lib/weekly-services";

export function staffingMonth(date = new Date()) { return churchDateKey(date).slice(0, 7); }
export function staffingMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
  const next = new Date(`${month}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: churchDateTime(`${month}-01`, "00:00"), to: churchDateTime(next.toISOString().slice(0, 10), "00:00") };
}
export function staffingState(schedule: { staffingCompletedAt: Date | null; assignments: { status: string; substitutionRequests?: { status: string }[] }[] }) {
  const available = schedule.assignments.filter(a => a.status !== "DECLINED" && a.status !== "NO_SHOW");
  if (schedule.assignments.some(a => a.status === "DECLINED" || a.status === "NO_SHOW" || a.substitutionRequests?.some(r => ["REQUESTED", "VOLUNTEER_B_ACCEPTED"].includes(r.status)))) return { key: "review", label: "Revisar equipe" };
  if (!available.length) return { key: "pending", label: "Pendente de escala" };
  if (schedule.staffingCompletedAt) return { key: "complete", label: "Montagem concluída" };
  return { key: "draft", label: "Em montagem" };
}
export function staffingUrl(id: string, startsAt: Date) { return `/admin/schedules?month=${staffingMonth(startsAt)}&focus=${encodeURIComponent(id)}#schedule-${encodeURIComponent(id)}`; }
