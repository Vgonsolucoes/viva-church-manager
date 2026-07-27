import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { public: true, startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: 30,
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
      bannerImageUrl: e.bannerImageUrl,
      capacity: e.capacity,
      isPaid: e.isPaid,
      ticketPriceCents: e.ticketPriceCents,
      allowPix: e.allowPix,
      allowCreditCard: e.allowCreditCard,
    })),
  );
}
