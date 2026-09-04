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

  const permError = requirePermission(ctx, "ministries:read");
  if (permError) return permError;

  if (!ctx.member) {
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  }

  const memberMinistries = await prisma.memberMinistry.findMany({
    where: { memberId: ctx.member.id },
    include: {
      ministry: true,
    },
    orderBy: {
      ministry: { name: "asc" },
    },
  });

  const ministryIds = memberMinistries.map((mm) => mm.ministryId);

  const volunteerCounts = await prisma.volunteerProfile.groupBy({
    by: ["ministryId"],
    where: {
      ministryId: { in: ministryIds },
    },
    _count: {
      _all: true,
    },
  });

  const countMap = new Map<string, number>();
  for (const vc of volunteerCounts) {
    if (vc.ministryId) {
      countMap.set(vc.ministryId, vc._count._all);
    }
  }

  const result = memberMinistries.map((mm) => ({
    id: mm.id,
    memberId: mm.memberId,
    ministryId: mm.ministryId,
    createdAt: mm.createdAt,
    ministry: mm.ministry,
    volunteersCount: countMap.get(mm.ministryId) ?? 0,
  }));

  return NextResponse.json(result);
}
