import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  if (!ctx.volunteerProfile) {
    return NextResponse.json([]);
  }

  const canRead = hasPermission(ctx.roles as any, "schedules:read");
  if (!canRead) {
    if (!ctx.volunteerProfile) {
      return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") as "upcoming" | "history") ?? "upcoming";

  const now = new Date();
  const sortOrder = range === "upcoming" ? "asc" : "desc";
  const dateFilter =
    range === "upcoming"
      ? { gte: now }
      : { lt: now };

  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      volunteerId: ctx.volunteerProfile.id,
      schedule: {
        startsAt: dateFilter,
      },
    },
    include: {
      schedule: {
        include: {
          ministry: true,
        },
      },
      substitutionRequests: {
        where: {
          OR: [
            { status: "REQUESTED" },
            { status: "VOLUNTEER_B_ACCEPTED" },
          ],
        },
        take: 1,
      },
    },
    orderBy: {
      schedule: {
        startsAt: sortOrder,
      },
    },
  });

  const result = assignments.map((a: any) => ({
    ...a,
    substitutionRequested: a.substitutionRequests.length > 0,
    substitutionRequests: undefined,
  }));

  return NextResponse.json(result);
}
