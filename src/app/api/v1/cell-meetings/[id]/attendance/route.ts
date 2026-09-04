import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const AttendanceBodySchema = z.object({
  attendances: z.array(
    z.object({
      memberId: z.string().min(1),
      present: z.boolean(),
    }),
  ),
  visitorsCount: z.number().int().min(0).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  const rawBody = await req.json();
  const parsed = AttendanceBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const cellMeeting = await prisma.cellMeeting.findUnique({
    where: { id },
    include: { cell: true },
  });

  if (!cellMeeting) {
    return NextResponse.json(
      { error: "CELL_MEETING_NOT_FOUND" },
      { status: 404 },
    );
  }

  const isLeader =
    ctx.member?.id === cellMeeting.cell.leaderId;
  const canWriteCells = hasPermission(ctx.roles, "cells:write");

  if (!isLeader && !canWriteCells) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  const { attendances, visitorsCount } = parsed.data;

  await prisma.$transaction(async (tx) => {
    for (const entry of attendances) {
      await tx.cellMeetingAttendance.upsert({
        where: {
          meetingId_memberId: {
            meetingId: cellMeeting.id,
            memberId: entry.memberId,
          },
        },
        create: {
          meetingId: cellMeeting.id,
          memberId: entry.memberId,
          present: entry.present,
        },
        update: {
          present: entry.present,
        },
      });
    }

    const presentCount = attendances.filter((a) => a.present).length;
    const finalVisitors = visitorsCount ?? cellMeeting.visitorsCount ?? 0;
    const participantsCount = presentCount + finalVisitors;

    await tx.cellMeeting.update({
      where: { id: cellMeeting.id },
      data: {
        participantsCount,
        visitorsCount: visitorsCount ?? cellMeeting.visitorsCount,
      },
    });
  });

  const updatedMeeting = await prisma.cellMeeting.findUnique({
    where: { id: cellMeeting.id },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "ATTENDANCE_UPDATED",
    entityType: "CellMeeting",
    entityId: cellMeeting.id,
    after: updatedMeeting,
  });

  return NextResponse.json({ ok: true });
}
