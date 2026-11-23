import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { prisma } from "@/server/db";
import { getArrivalConfig } from "@/server/service-arrival";
import { ensureWeeklyServices } from "@/server/weekly-services";
import { arrivalWindow } from "@/lib/service-arrival";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  if (!auth.ctx.member)
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  const now = new Date();
  await ensureWeeklyServices(now);
  const [config, consent, events] = await Promise.all([
    getArrivalConfig(),
    prisma.arrivalConsent.findUnique({
      where: { memberId: auth.ctx.member.id },
    }),
    prisma.event.findMany({
      where: {
        type: "SERVICE",
        geoCheckIn: true,
        startsAt: {
          gte: new Date(now.getTime() - 86400000),
          lt: new Date(now.getTime() + 14 * 86400000),
        },
      },
      select: { id: true, name: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  return NextResponse.json(
    {
      config,
      consent: consent?.enabled ?? false,
      memberId: auth.ctx.member.id,
      services: events.map((event) => ({
        id: event.id,
        name: event.name,
        startsAt: event.startsAt,
        ...arrivalWindow(event, config),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
