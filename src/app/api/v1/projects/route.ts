import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const permErr = requirePermission(ctx, "calendar:read");
  if (permErr) return permErr;

  const projects = await prisma.fundraisingProject.findMany({
    where: { public: true },
    orderBy: { createdAt: "desc" },
    include: {
      donations: { select: { amountCents: true } },
      financeTransactions: {
        where: { direction: "IN" },
        select: { amountCents: true },
      },
    },
  });

  return NextResponse.json(
    projects.map((p: any) => {
      const donationCents = p.donations.reduce((acc: number, d: any) => acc + d.amountCents, 0);
      const financeCents = p.financeTransactions.reduce(
        (acc: number, t: any) => acc + t.amountCents,
        0,
      );
      const raisedCents = donationCents + financeCents;
      const percent = p.goalCents
        ? Math.min(100, Math.round((raisedCents * 100) / p.goalCents) || 0)
        : 0;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        goalCents: p.goalCents,
        raisedCents,
        percent,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      };
    }),
  );
}
