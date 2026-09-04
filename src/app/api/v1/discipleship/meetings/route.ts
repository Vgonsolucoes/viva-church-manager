import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const MeetingBodySchema = z.object({
  discipleshipId: z.string().min(1),
  meetingAt: z.coerce.date(),
  theme: z.string().min(1),
  notes: z.string().optional(),
  nextMeetingAt: z.coerce.date().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "MISSED"]),
});

export async function POST(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const rawBody = await req.json();
  const parsed = MeetingBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { discipleshipId, meetingAt, theme, notes, nextMeetingAt, status } =
    parsed.data;

  const discipleship = await prisma.discipleship.findUnique({
    where: { id: discipleshipId },
  });

  if (!discipleship) {
    return NextResponse.json(
      { error: "DISCIPLESHIP_NOT_FOUND" },
      { status: 404 },
    );
  }

  const canWriteAll = hasPermission(ctx.roles, "discipleships:write");
  const canWriteMy = hasPermission(ctx.roles, "discipleship:my:write");
  const isDiscipler = ctx.member?.id === discipleship.disciplerId;

  if (!canWriteAll && !(canWriteMy && isDiscipler)) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  let createdMeeting: unknown = null;

  await prisma.$transaction(async (tx) => {
    createdMeeting = await tx.discipleshipMeeting.create({
      data: {
        discipleshipId,
        meetingAt,
        theme,
        notes: notes ?? null,
        nextMeetingAt: nextMeetingAt ?? null,
        status,
        createdById: ctx.user.id,
      },
    });

    const discipleshipUpdates: {
      meetingsDone?: { increment: number };
      nextMeetingAt?: Date | null;
    } = {};

    if (status === "COMPLETED") {
      discipleshipUpdates.meetingsDone = { increment: 1 };
    }

    if (nextMeetingAt !== undefined) {
      discipleshipUpdates.nextMeetingAt = nextMeetingAt ?? null;
    }

    if (Object.keys(discipleshipUpdates).length > 0) {
      await tx.discipleship.update({
        where: { id: discipleshipId },
        data: discipleshipUpdates,
      });
    }
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "MEETING_RECORDED",
    entityType: "DiscipleshipMeeting",
    entityId: (createdMeeting as { id: string })?.id ?? null,
    after: createdMeeting,
  });

  return NextResponse.json({ ok: true, meeting: createdMeeting });
}
