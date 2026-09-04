import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { calculateNextWeekdayMeeting } from "@/server/utils/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  if (!ctx.member) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const memberId = ctx.member.id;
  const canWriteCells = hasPermission(ctx.roles, "cells:write");

  const cells = await prisma.cell.findMany({
    where: {
      OR: [{ leaderId: memberId }, { hostId: memberId }],
    },
    include: {
      leader: { select: { id: true, fullName: true, photoUrl: true } },
      host: { select: { id: true, fullName: true, photoUrl: true } },
    },
    orderBy: { weekday: "asc" },
  });

  const result = await Promise.all(
    cells.map(async (cell) => {
      const isLeader = cell.leaderId === memberId;
      const includeMembers = canWriteCells && isLeader;

      let members:
        | Array<{ id: string; fullName: string; photoUrl: string | null }>
        | undefined;

      if (includeMembers) {
        const memberList = await prisma.member.findMany({
          where: { participatesInCell: true },
          select: { id: true, fullName: true, photoUrl: true },
          orderBy: { fullName: "asc" },
        });
        members = memberList;
      }

      const nextMeetingAt = calculateNextWeekdayMeeting(cell.weekday, cell.time);

      return {
        id: cell.id,
        name: cell.name,
        leader: {
          id: cell.leader.id,
          name: cell.leader.fullName,
          photo: cell.leader.photoUrl,
        },
        host: cell.host
          ? {
              id: cell.host.id,
              name: cell.host.fullName,
              photo: cell.host.photoUrl,
            }
          : null,
        weekday: cell.weekday,
        time: cell.time,
        address: cell.address,
        nextMeetingAt,
        members,
      };
    }),
  );

  return NextResponse.json(result);
}
