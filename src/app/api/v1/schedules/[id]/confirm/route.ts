import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

async function findAssignmentWithAccess(
  scheduleId: string,
  ctx: { volunteerProfile: { id: string } | null; user: { id: string }; roles: string[]; permissions: string[] }
): Promise<{ assignment: any | null; isOwner: boolean; canWrite: boolean }> {
  const assignment = await prisma.scheduleAssignment.findFirst({
    where: { scheduleId },
    include: { schedule: { select: { ministryId: true } } },
  });
  if (!assignment) return { assignment: null, isOwner: false, canWrite: false };

  const isOwner = !!ctx.volunteerProfile && assignment.volunteerId === ctx.volunteerProfile.id;
  const canWrite = hasPermission(ctx.roles as any, "schedules:write");

  return { assignment, isOwner, canWrite };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const scheduleId = id;

  const { assignment, isOwner, canWrite } = await findAssignmentWithAccess(scheduleId, ctx);
  if (!assignment) {
    return NextResponse.json({ error: "ASSIGNMENT_NOT_FOUND" }, { status: 404 });
  }

  if (!isOwner && !canWrite) {
    const perm = requirePermission(ctx, "schedules:write");
    if (perm) return perm;
  }

  const updated = await prisma.scheduleAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      justification: JSON.stringify({ reason: "CONFIRMED" }),
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "CONFIRM",
    entityType: "ScheduleAssignment",
    entityId: updated.id,
    after: updated,
  });

  return NextResponse.json(updated);
}
