import { endOfMonth, startOfMonth } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { DashboardClient } from "@/app/(admin)/admin/ui/DashboardClient";

export const dynamic = "force-dynamic";

function monthRange(date = new Date()) {
  return { from: startOfMonth(date), to: endOfMonth(date) };
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const now = new Date();
  const month = monthRange(now);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalMembers,
    newMembers,
    volunteersActive,
    schedulesPending,
    upcomingServices,
    upcomingEvents,
    cellsTotal,
    cellsActive,
    cellsNew,
    financeIn,
    financeOut,
    fundraisingPublic,
    assetsCount,
    kidsActive,
    lostFoundPending,
    financeRows,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.member.count({ where: { createdAt: { gte: last30 } } }),
    prisma.volunteerProfile.count(),
    prisma.scheduleAssignment.count({
      where: {
        status: "PENDING",
        schedule: { startsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
      },
    }),
    prisma.schedule.findMany({
      where: { kind: "SERVICE", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.cell.count(),
    prisma.cell.count({ where: { meetings: { some: { meetingDate: { gte: last30 } } } } }),
    prisma.cell.count({ where: { createdAt: { gte: last30 } } }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "IN", occurredAt: { gte: month.from, lte: month.to } },
    }),
    prisma.financeTransaction.aggregate({
      _sum: { amountCents: true },
      where: { direction: "OUT", occurredAt: { gte: month.from, lte: month.to } },
    }),
    prisma.fundraisingProject.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { donations: true },
    }),
    prisma.asset.count(),
    prisma.childCheckIn.count({ where: { status: "CHECKED_IN" } }),
    prisma.lostFoundItem.count({ where: { status: "WAITING_PICKUP" } }),
    prisma.financeTransaction.findMany({
      where: { occurredAt: { gte: month.from, lte: month.to } },
      select: { occurredAt: true, direction: true, amountCents: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const inCents = financeIn._sum.amountCents ?? 0;
  const outCents = financeOut._sum.amountCents ?? 0;
  const balanceCents = inCents - outCents;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const buckets = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return {
      label: String(day).padStart(2, "0"),
      inCents: 0,
      outCents: 0,
      balanceCents: 0,
    };
  });

  financeRows.forEach((r) => {
    const d = r.occurredAt.getDate();
    const i = d - 1;
    if (!buckets[i]) return;
    if (r.direction === "IN") buckets[i]!.inCents += r.amountCents;
    if (r.direction === "OUT") buckets[i]!.outCents += r.amountCents;
  });

  let running = 0;
  buckets.forEach((b) => {
    running += b.inCents - b.outCents;
    b.balanceCents = running;
  });

  const services = upcomingServices.map((s) => {
    const dt = s.startsAt;
    const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(dt);
    const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(dt).toUpperCase();
    const subtitle = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
    return { id: s.id, title: s.title, subtitle, day, month };
  });

  const events = upcomingEvents.map((e) => {
    const dt = e.startsAt;
    const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(dt);
    const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(dt).toUpperCase();
    const subtitle = `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(dt)}${e.location ? ` • ${e.location}` : ""}`;
    return { id: e.id, title: e.name, subtitle, day, month };
  });

  const cellsForming = Math.max(0, cellsTotal - cellsActive - cellsNew);
  const greetingName =
    session?.user?.name?.split(" ")?.[0] ? `Pastor ${session.user.name.split(" ")[0]}` : "Pastor";
  const alertsCount = schedulesPending + lostFoundPending + kidsActive;

  const fundraising = fundraisingPublic.map((p) => {
    const raised = p.donations.reduce((acc, d) => acc + d.amountCents, 0);
    const pct = p.goalCents ? Math.min(100, Math.round((raised / p.goalCents) * 100)) : 0;
    return { id: p.id, name: p.name, raisedCents: raised, goalCents: p.goalCents, pct };
  });

  return (
    <DashboardClient
      greetingName={greetingName}
      metrics={{
        members: totalMembers,
        newMembers,
        volunteers: volunteersActive,
        schedulesPending,
      }}
      services={services}
      events={events}
      cells={{
        total: cellsTotal,
        active: cellsActive,
        newCells: cellsNew,
        forming: cellsForming,
      }}
      finance={{
        inCents,
        outCents,
        balanceCents,
        series: buckets,
      }}
      fundraising={fundraising}
      bottom={{
        assetsCount,
        kidsActive,
        lostFoundPending,
        alertsCount,
      }}
    />
  );
}
