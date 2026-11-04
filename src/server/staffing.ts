import { prisma } from "@/server/db";
import { staffingMonth, staffingMonthRange } from "@/lib/staffing";

type Source = { id: string; startsAt: Date; endsAt: Date | null } & ({ name: string; type: string } | { title: string; agendaVisible: boolean });
export async function syncStaffingSchedule(source: Source, now = new Date()) {
  const event = "name" in source;
  const id = `staffing-${event ? "event" : "course"}-${source.id}`;
  const existing = await prisma.schedule.findUnique({ where: { id }, select: { id: true, title: true, kind: true, startsAt: true, endsAt: true } });
  if (!existing) {
    // Respect schedules already explicitly linked to this source.
    const linked = await prisma.schedule.findFirst({ where: event ? { eventId: source.id } : { courseId: source.id }, select: { id: true } });
    if (linked) return linked.id;
    // Required-course templates have a nominal creation date, not an execution date.
    if (!event && !source.agendaVisible && source.startsAt < now) return null;
  }
  const data = { title: event ? source.name : source.title, kind: event && source.type === "SERVICE" ? "SERVICE" as const : event ? "EVENT" as const : "OTHER" as const, startsAt: source.startsAt, endsAt: source.endsAt };
  const moved = existing && (existing.startsAt.getTime() !== source.startsAt.getTime() || existing.endsAt?.getTime() !== source.endsAt?.getTime());
  const changed = existing && (existing.title !== data.title || existing.kind !== data.kind || moved);
  if (existing && !changed) return id;
  await prisma.$transaction(async tx => {
    await tx.schedule.upsert({ where: { id }, create: { id, ...data, ...(event ? { eventId: source.id } : { courseId: source.id }) }, update: changed ? { ...data, ...(moved ? { staffingCompletedAt: null } : {}) } : {} });
    if (moved) await tx.scheduleAssignment.updateMany({ where: { scheduleId: id, status: { not: "DECLINED" } }, data: { status: "PENDING", confirmedAt: null } });
  });
  return id;
}

/** Recover any pending source even if its creation request ended before scheduling. */
export async function ensureStaffingSchedules(now = new Date()) {
  const { from } = staffingMonthRange(staffingMonth(now));
  const [events, courses] = await Promise.all([
    prisma.event.findMany({ where: { startsAt: { gte: from } }, select: { id: true, name: true, type: true, startsAt: true, endsAt: true } }),
    prisma.course.findMany({ where: { startsAt: { gte: from }, OR: [{ agendaVisible: true }, { startsAt: { gte: now } }, { schedules: { some: {} } }] }, select: { id: true, title: true, startsAt: true, endsAt: true, agendaVisible: true } }),
  ]);
  for (const source of [...events, ...courses]) await syncStaffingSchedule(source, now);
}
