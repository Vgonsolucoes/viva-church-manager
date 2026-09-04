import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  if (!hasPermission(ctx.roles, "kids:checkin:self")) {
    const err = requirePermission(ctx, "kids:checkin:self");
    if (err) return err;
  }

  const memberName = ctx.member?.fullName;
  const memberPhone = ctx.member?.phone;

  if (!memberName && !memberPhone) {
    return NextResponse.json([]);
  }

  const where: any = { OR: [] };
  if (memberName) {
    where.OR.push({
      fullName: {
        equals: memberName,
        mode: "insensitive",
      },
    });
  }
  if (memberPhone) {
    where.OR.push({ phone: memberPhone });
  }

  const guardians = await prisma.childGuardian.findMany({
    where,
    include: {
      child: {
        include: {
          guardians: true,
          checkins: {
            where: { status: "CHECKED_IN" },
            orderBy: { checkInAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const childIds = new Set<string>();
  const children: any[] = [];

  for (const g of guardians) {
    if (childIds.has(g.child.id)) continue;
    childIds.add(g.child.id);
    const pendingCheckIn = g.child.checkins[0] ?? null;
    children.push({
      id: g.child.id,
      fullName: g.child.fullName,
      birthDate: g.child.birthDate,
      allergies: g.child.allergies,
      notes: g.child.notes,
      guardians: g.child.guardians,
      pendingCheckIn,
    });
  }

  return NextResponse.json(children);
}
