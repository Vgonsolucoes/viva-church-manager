import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  const projects = await prisma.fundraisingProject.findMany({
    where: { public: true },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { donations: true },
  });

  return NextResponse.json(
    projects.map((p) => {
      const raisedCents = p.donations.reduce((acc, d) => acc + d.amountCents, 0);
      const pct = p.goalCents ? Math.min(100, Math.round((raisedCents / p.goalCents) * 100)) : 0;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        goalCents: p.goalCents,
        raisedCents,
        percent: pct,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      };
    }),
  );
}
