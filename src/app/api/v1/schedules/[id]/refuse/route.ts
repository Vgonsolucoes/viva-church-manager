import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  reason: z.enum(["TRABALHO", "VIAGEM", "FAMILIAR", "SAUDE", "OUTRO"]),
  note: z.string().max(1000).optional(),
});

async function findAssignmentWithAccess(
  scheduleId: string,
  ctx: { volunteerProfile: { id: string } | null; user: { id: string }; roles: string[]; permissions: string[] }
): Promise<{ assignment: any | null; isOwner: boolean; canWrite: boolean }> {
  const assignment = await prisma.scheduleAssignment.findFirst({
    where: { scheduleId },
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
      status: "DECLINED",
      justification: JSON.stringify(parsed.data),
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "DECLINE",
    entityType: "ScheduleAssignment",
    entityId: updated.id,
    after: updated,
  });

  return NextResponse.json(updated);
}
