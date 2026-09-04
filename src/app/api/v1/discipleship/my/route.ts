import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  requireLoggedIn,
  requirePermission,
} from "@/server/session-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const permError = requirePermission(ctx, "discipleship:my:read");
  if (permError) return permError;

  if (!ctx.member) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const memberId = ctx.member.id;

  const asDisciple = await prisma.discipleship.findFirst({
    where: {
      discipleId: memberId,
      status: "ACTIVE",
    },
    include: {
      discipler: {
        select: { id: true, fullName: true, photoUrl: true },
      },
    },
  });

  let disciplerLastMeeting: unknown = null;
  let disciplerNextMeeting: Date | null = null;

  if (asDisciple) {
    disciplerNextMeeting = asDisciple.nextMeetingAt ?? null;
    disciplerLastMeeting = await prisma.discipleshipMeeting.findFirst({
      where: {
        discipleshipId: asDisciple.id,
        status: "COMPLETED",
      },
      orderBy: { meetingAt: "desc" },
    });
  }

  const myDiscipleships = await prisma.discipleship.findMany({
    where: {
      disciplerId: memberId,
      status: "ACTIVE",
    },
    include: {
      disciple: {
        select: { id: true, fullName: true, photoUrl: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const myDisciples = myDiscipleships.map((d) => ({
    disciple: d.disciple,
    meetingsDone: d.meetingsDone,
    progress: d.progress,
    nextMeetingAt: d.nextMeetingAt,
  }));

  const response = {
    discipulator: asDisciple
      ? {
          id: asDisciple.id,
          startedAt: asDisciple.startedAt,
          status: asDisciple.status,
          level: asDisciple.level,
          meetingsDone: asDisciple.meetingsDone,
          progress: asDisciple.progress,
          discipler: asDisciple.discipler,
        }
      : null,
    disciplerLastMeeting,
    disciplerNextMeeting,
    myDisciples,
  };

  return NextResponse.json(response);
}
