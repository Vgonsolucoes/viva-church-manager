import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

type AgendaItem = {
  id: string;
  type: "schedule" | "event" | "cell" | "discipleship";
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  responsible?: string | null;
  ministry?: string | null;
};

const QuerySchema = z.object({
  range: z.enum(["today", "week", "month"]).default("week"),
  category: z.string().optional(),
});

function getRangeDates(range: "today" | "week" | "month"): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);
  let to: Date;

  if (range === "today") {
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setDate(to.getDate() + 1);
  } else if (range === "week") {
    from.setHours(0, 0, 0, 0);
    const day = from.getDay();
    from.setDate(from.getDate() - day);
    to = new Date(from);
    to.setDate(to.getDate() + 7);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setMonth(to.getMonth() + 1);
  }

  return { from, to };
}

function categoryAllowed(categories: string[] | undefined, itemType: string): boolean {
  if (!categories || categories.length === 0) return true;
  const map: Record<string, string[]> = {
    schedule: ["SCHEDULE"],
    event: ["SERVICE", "EVENT", "CONFERENCE", "MEETING", "REHEARSAL"],
    cell: ["CELL"],
    discipleship: ["DISCIPLESHIP"],
  };
  const allowed = map[itemType] ?? [];
  return allowed.some((c) => categories.includes(c));
}

function getNextCellMeetingDate(cell: { weekday: number; time: string }): Date {
  const now = new Date();
  const result = new Date(now);
  result.setHours(0, 0, 0, 0);
  const currentDay = result.getDay();
  let diff = cell.weekday - currentDay;
  if (diff < 0) diff += 7;
  result.setDate(result.getDate() + diff);
  const [h, m] = cell.time.split(":").map(Number);
  result.setHours(h ?? 19, m ?? 0, 0, 0);
  return result;
}

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const query = QuerySchema.safeParse({
    range: searchParams.get("range"),
    category: searchParams.get("category"),
  });
  if (!query.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: query.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { range } = query.data;
  const categories = query.data.category
    ? query.data.category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : undefined;

  const { from, to } = getRangeDates(range);

  const canCalendarRead = hasPermission(ctx.roles as any, "calendar:read");
  const canEventsRead = hasPermission(ctx.roles as any, "events:read");
  const canSchedulesRead = hasPermission(ctx.roles as any, "schedules:read");
  const memberId = (ctx.user as any).memberId ?? ctx.user.member?.id;

  const items: AgendaItem[] = [];

  if (categoryAllowed(categories, "schedule")) {
    if (canCalendarRead || canSchedulesRead) {
      const schedules = await prisma.schedule.findMany({
        where: {
          startsAt: { gte: from, lt: to },
        },
        include: { ministry: true },
      });
      for (const s of schedules) {
        items.push({
          id: `sched-${s.id}`,
          type: "schedule",
          title: s.title,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt ? s.endsAt.toISOString() : null,
          ministry: s.ministry ? s.ministry.name : null,
        });
      }
    } else if (ctx.volunteerProfile) {
      const schedules = await prisma.schedule.findMany({
        where: {
          startsAt: { gte: from, lt: to },
          assignments: {
            some: { volunteerId: ctx.volunteerProfile.id },
          },
        },
        include: { ministry: true },
      });
      for (const s of schedules) {
        items.push({
          id: `sched-${s.id}`,
          type: "schedule",
          title: s.title,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt ? s.endsAt.toISOString() : null,
          ministry: s.ministry ? s.ministry.name : null,
        });
      }
    }
  }

  if (categoryAllowed(categories, "event")) {
    const eventWhere: any = {
      startsAt: { gte: from, lt: to },
    };
    if (!canCalendarRead && !canEventsRead) {
      eventWhere.public = true;
    }
    const events = await prisma.event.findMany({
      where: eventWhere,
      include: {
        responsible: { select: { fullName: true } },
      },
    });
    for (const e of events) {
      items.push({
        id: `evt-${e.id}`,
        type: "event",
        title: e.name,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt ? e.endsAt.toISOString() : null,
        location: e.location,
        responsible: e.responsible ? e.responsible.fullName : null,
      });
    }
  }

  if (categoryAllowed(categories, "cell")) {
    if (memberId) {
      const cells = await prisma.cell.findMany({
        where: {
          OR: [{ leaderId: memberId }, { hostId: memberId }],
        },
      });
      for (const c of cells) {
        const meetingDate = getNextCellMeetingDate(c);
        if (meetingDate >= from && meetingDate < to) {
          items.push({
            id: `cell-${c.id}`,
            type: "cell",
            title: c.name,
            startsAt: meetingDate.toISOString(),
            location: c.address,
          });
        }
      }
      if (canCalendarRead) {
        const allCells = await prisma.cell.findMany();
        const existingCellIds = new Set(items.filter((i) => i.type === "cell").map((i) => i.id));
        for (const c of allCells) {
          if (existingCellIds.has(`cell-${c.id}`)) continue;
          const meetingDate = getNextCellMeetingDate(c);
          if (meetingDate >= from && meetingDate < to) {
            items.push({
              id: `cell-${c.id}`,
              type: "cell",
              title: c.name,
              startsAt: meetingDate.toISOString(),
              location: c.address,
            });
          }
        }
      }
    }
  }

  if (categoryAllowed(categories, "discipleship")) {
    if (memberId) {
      const meetings = await prisma.discipleshipMeeting.findMany({
        where: {
          meetingAt: { gte: from, lt: to },
          discipleship: {
            OR: [{ discipleId: memberId }, { disciplerId: memberId }],
          },
        },
        include: {
          discipleship: {
            include: {
              disciple: { select: { fullName: true } },
              discipler: { select: { fullName: true } },
            },
          },
        },
      });
      for (const m of meetings) {
        const other =
          m.discipleship.discipleId === memberId
            ? m.discipleship.discipler.fullName
            : m.discipleship.disciple.fullName;
        items.push({
          id: `disc-${m.id}`,
          type: "discipleship",
          title: `Encontro: ${other}`,
          startsAt: m.meetingAt.toISOString(),
          responsible: other,
        });
      }
    }
  }

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return NextResponse.json(items);
}
