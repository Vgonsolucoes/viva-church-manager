import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  const cells = await prisma.cell.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { leader: true },
  });

  return NextResponse.json(
    cells.map((c) => ({
      id: c.id,
      name: c.name,
      weekday: c.weekday,
      time: c.time,
      address: c.address,
      leaderName: c.leader.fullName,
    })),
  );
}
