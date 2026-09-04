import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const canWrite = hasPermission(ctx.roles, "events:write");
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      startsAt: { gte: threeDaysAgo },
      ...(canWrite ? {} : { public: true }),
    },
    include: {
      responsible: {
        select: { id: true, fullName: true, photoUrl: true },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(
    events.map((e: any) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
      bannerImageUrl: e.bannerImageUrl,
      responsibleMemberId: e.responsibleMemberId,
      responsible: e.responsible
        ? {
            id: e.responsible.id,
            fullName: e.responsible.fullName,
            photoUrl: e.responsible.photoUrl,
          }
        : null,
      ministriesInvolved: e.ministriesInvolved,
      volunteersNeeded: e.volunteersNeeded,
      budgetCents: e.budgetCents,
      capacity: e.capacity,
      isPaid: e.isPaid,
      ticketPriceCents: e.ticketPriceCents,
      allowPix: e.allowPix,
      allowCreditCard: e.allowCreditCard,
      public: e.public,
    })),
  );
}
