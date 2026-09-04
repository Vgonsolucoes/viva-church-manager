import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  status: z.enum(["VOLUNTEER_B_ACCEPTED", "APPROVED_BY_LEADER", "REJECTED"]),
});

async function isMinistryLeaderOfSchedule(
  ctx: {
    volunteerProfile: { id: string; ministryId?: string | null } | null;
    user: { id: string; member?: { memberMinistries: { ministry: { id: string } }[] } | null };
    roles: string[];
    member: { memberMinistries: { ministry: { id: string; name: string } }[] } | null;
  },
  scheduleMinistryId: string | null
): Promise<boolean> {
  const canWrite = hasPermission(ctx.roles as any, "schedules:write");
  if (canWrite) return true;

  if (!scheduleMinistryId) return false;

  const memberMinistries = ctx.member?.memberMinistries ?? ctx.user.member?.memberMinistries ?? [];
  return memberMinistries.some((mm) => mm.ministry.id === scheduleMinistryId);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const requestId = id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const substitutionRequest = await prisma.scheduleSubstitutionRequest.findUnique({
    where: { id: requestId },
    include: {
      assignment: { include: { schedule: { select: { ministryId: true, id: true } } } },
    },
  });
  if (!substitutionRequest) {
    return NextResponse.json({ error: "SUBSTITUTION_REQUEST_NOT_FOUND" }, { status: 404 });
  }

  const { status } = parsed.data;
  const canWrite = hasPermission(ctx.roles as any, "schedules:write");
  const isLeader = await isMinistryLeaderOfSchedule(ctx, substitutionRequest.assignment.schedule.ministryId);

  if (status === "VOLUNTEER_B_ACCEPTED") {
    if (!ctx.volunteerProfile || substitutionRequest.toVolunteerId !== ctx.volunteerProfile.id) {
      return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    }
  } else if (status === "APPROVED_BY_LEADER" || status === "REJECTED") {
    if (!canWrite && !isLeader) {
      const perm = requirePermission(ctx, "schedules:write");
      if (perm) return perm;
    }
  }

  if (status === "APPROVED_BY_LEADER") {
    const result = await prisma.$transaction(async (tx: any) => {
      const updatedRequest = await tx.scheduleSubstitutionRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED_BY_LEADER",
          approvedAt: new Date(),
          approvedById: ctx.user.id,
        },
      });

      const originalAssignment = await tx.scheduleAssignment.update({
        where: { id: substitutionRequest.assignmentId },
        data: {
          status: "DECLINED",
          justification: JSON.stringify({ reason: "SUBSTITUTION_APPROVED" }),
        },
      });

      const toVolunteerAssignment = await tx.scheduleAssignment.upsert({
        where: {
          scheduleId_volunteerId_roleName: {
            scheduleId: substitutionRequest.assignment.schedule.id,
            volunteerId: substitutionRequest.toVolunteerId,
            roleName: originalAssignment.roleName,
          },
        } as any,
        create: {
          scheduleId: substitutionRequest.assignment.schedule.id,
          volunteerId: substitutionRequest.toVolunteerId,
          roleName: originalAssignment.roleName,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          justification: JSON.stringify({ reason: "SUBSTITUTION_APPROVED" }),
        },
        update: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          justification: JSON.stringify({ reason: "SUBSTITUTION_APPROVED" }),
        },
      });

      return { updatedRequest, originalAssignment, toVolunteerAssignment };
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "SUBSTITUTION_APPROVED",
      entityType: "ScheduleSubstitutionRequest",
      entityId: result.updatedRequest.id,
      after: result.updatedRequest,
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "DECLINED_BY_SUBSTITUTION",
      entityType: "ScheduleAssignment",
      entityId: result.originalAssignment.id,
      after: result.originalAssignment,
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "CREATED_BY_SUBSTITUTION",
      entityType: "ScheduleAssignment",
      entityId: result.toVolunteerAssignment.id,
      after: result.toVolunteerAssignment,
    });

    return NextResponse.json(result.updatedRequest);
  } else if (status === "REJECTED") {
    const updated = await prisma.scheduleSubstitutionRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "SUBSTITUTION_REJECTED",
      entityType: "ScheduleSubstitutionRequest",
      entityId: updated.id,
      after: updated,
    });

    return NextResponse.json(updated);
  } else {
    const updated = await prisma.scheduleSubstitutionRequest.update({
      where: { id: requestId },
      data: { status: "VOLUNTEER_B_ACCEPTED" },
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "SUBSTITUTION_ACCEPTED_BY_VOLUNTEER_B",
      entityType: "ScheduleSubstitutionRequest",
      entityId: updated.id,
      after: updated,
    });

    return NextResponse.json(updated);
  }
}
