import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  toVolunteerId: z.string().min(1),
  reason: z.enum(["TRABALHO", "VIAGEM", "FAMILIAR", "SAUDE", "OUTRO"]),
  note: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const scheduleId = id;

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

  const assignment = await prisma.scheduleAssignment.findFirst({
    where: { scheduleId },
  });
  if (!assignment) {
    return NextResponse.json({ error: "ASSIGNMENT_NOT_FOUND" }, { status: 404 });
  }

  const isOwner = !!ctx.volunteerProfile && assignment.volunteerId === ctx.volunteerProfile.id;
  const canWrite = hasPermission(ctx.roles as any, "schedules:write");

  if (!isOwner && !canWrite) {
    const perm = requirePermission(ctx, "schedules:write");
    if (perm) return perm;
  }

  if (!ctx.volunteerProfile) {
    return NextResponse.json({ error: "VOLUNTEER_PROFILE_REQUIRED" }, { status: 403 });
  }

  const fromVolunteerId = isOwner ? ctx.volunteerProfile.id : assignment.volunteerId;

  const request = await prisma.scheduleSubstitutionRequest.create({
    data: {
      assignmentId: assignment.id,
      fromVolunteerId,
      toVolunteerId: parsed.data.toVolunteerId,
      status: "REQUESTED",
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "SUBSTITUTION_REQUESTED",
    entityType: "ScheduleSubstitutionRequest",
    entityId: request.id,
    after: request,
  });

  return NextResponse.json({ request }, { status: 201 });
}
