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
  const canWriteCells = hasPermission(ctx.permissions, "cells:write");
  const cellId = new URL(req.url).searchParams.get("cellId") || undefined;

  const cells = await prisma.cell.findMany({
    where: {
      id: cellId,
      OR: [{ leaderId: memberId }, { hostId: memberId }, { participants: { some: { id: memberId } } }],
    },
    include: {
      leader: { select: { id: true, fullName: true, photoUrl: true } },
      host: { select: { id: true, fullName: true, photoUrl: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { weekday: "asc" },
  });

  const assignedIndex = cells.findIndex((cell) => cell.leaderId === memberId);
  if (assignedIndex > 0) cells.unshift(...cells.splice(assignedIndex, 1));

  const result = await Promise.all(
    cells.map(async (cell) => {
      const isLeader = cell.leaderId === memberId;
      const includeMembers = canWriteCells && isLeader;

      let members:
        | Array<{ id: string; fullName: string; photoUrl: string | null }>
        | undefined;

      if (includeMembers) {
        const memberList = await prisma.member.findMany({
          where: { cellId: cell.id },
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
        leaderPhone: cell.leaderWhatsapp,
        membersCount: cell._count.participants,
        nextMeetingAt,
        members,
      };
    }),
  );

  return NextResponse.json(result);
}
