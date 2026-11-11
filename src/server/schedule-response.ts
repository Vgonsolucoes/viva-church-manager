import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { hasPermission } from "@/server/rbac";
import type { LoggedContext } from "@/server/session-helpers";

export async function respondToSchedule(
  ctx: LoggedContext,
  id: string,
  status: "CONFIRMED" | "DECLINED",
  justification: { reason: string; note?: string | null },
) {
  const volunteerId = ctx.volunteerProfile?.id;
  const canManage = hasPermission(ctx.permissions, "schedules:write");
  const assignment = await prisma.scheduleAssignment.findUnique({
    where: { id },
    select: { id: true, volunteerId: true },
  });
  if (assignment && assignment.volunteerId !== volunteerId && !canManage) {
    return NextResponse.json({ error: "PERMISSION_DENIED", message: "Esta escala pertence a outro voluntário." }, { status: 403 });
  }

  // Older callers can supply the schedule ID when it identifies a single assignment for them.
  const matches = !assignment && volunteerId ? await prisma.scheduleAssignment.findMany({
    where: { scheduleId: id, volunteerId },
    select: { id: true, volunteerId: true },
    take: 2,
  }) : [];
  if (matches.length > 1) {
    return NextResponse.json({ error: "AMBIGUOUS_ASSIGNMENT", message: "Atualize a lista e selecione a função da escala." }, { status: 409 });
  }
  const target = assignment ?? matches[0];
  if (!target) {
    return NextResponse.json({ error: "ASSIGNMENT_NOT_FOUND", message: "Escala não encontrada. Atualize a lista." }, { status: 404 });
  }

  const { changed, updated } = await prisma.$transaction(async (tx) => {
    const where = { id: target.id, volunteerId: target.volunteerId };
    const changed = await tx.scheduleAssignment.updateMany({
      where: { ...where, status: "PENDING" },
      data: { status, confirmedAt: status === "CONFIRMED" ? new Date() : null, justification: JSON.stringify(justification) },
    });
    const updated = await tx.scheduleAssignment.findUnique({ where });
    return { changed: changed.count > 0, updated };
  });
  if (!updated || updated.status !== status) {
    return NextResponse.json({ error: "ASSIGNMENT_CHANGED", message: "Esta escala já foi respondida ou alterada. Atualize a lista." }, { status: 409 });
  }
  if (changed) {
    await logAudit({
      actorUserId: ctx.user.id,
      action: status === "CONFIRMED" ? "CONFIRM" : "DECLINE",
      entityType: "ScheduleAssignment",
      entityId: updated.id,
      after: updated,
    });
  }
  return NextResponse.json(updated);
}
