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

  const memberId = ctx.member?.id ?? null;
  const memberName = ctx.member?.fullName;
  const memberPhone = ctx.member?.phone;

  if (!memberId && !memberName && !memberPhone) {
    return NextResponse.json([]);
  }

  const orConditions: (
    | { memberId: string }
    | { fullName: { equals: string; mode: "insensitive" } }
    | { phone: string }
  )[] = [];
  if (memberId) orConditions.push({ memberId });
  if (memberName) {
    orConditions.push({
      fullName: { equals: memberName, mode: "insensitive" },
    });
  }
  if (memberPhone) orConditions.push({ phone: memberPhone });

  const guardians = await prisma.childGuardian.findMany({
    where: { OR: orConditions },
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
  const children = [];

  for (const g of guardians) {
    if (childIds.has(g.child.id)) continue;
    childIds.add(g.child.id);
    const pendingCheckIn = g.child.checkins[0] ?? null;
    children.push({
      id: g.child.id,
      fullName: g.child.fullName,
      birthDate: g.child.birthDate,
      sex: g.child.sex,
      photoUrl: g.child.photoUrl,
      classroom: null,
      allergies: g.child.allergies,
      medications: g.child.medications,
      specialNeeds: g.child.specialNeeds,
      emergencyContact: g.child.emergencyContact,
      notes: g.child.notes,
      guardians: g.child.guardians.map((guardian) => ({
        id: guardian.id,
        fullName: guardian.fullName,
        phone: guardian.phone,
        relationship: guardian.relationship,
      })),
      pendingCheckIn,
    });
  }

  return NextResponse.json(children);
}
