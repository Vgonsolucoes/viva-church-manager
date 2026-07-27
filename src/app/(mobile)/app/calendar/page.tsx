import { getServerSession } from "next-auth";
import type { CourseAudience } from "@/generated/prisma/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function MobileCalendarPage() {
  const session = await getServerSession(authOptions);
  const now = new Date();
  const user = session?.uid
    ? await prisma.user.findUnique({
        where: { id: session.uid },
        select: {
          member: {
            select: {
              type: true,
              types: true,
            },
          },
        },
      })
    : null;

  const memberTypes = user?.member ? (user.member.types.length ? user.member.types : [user.member.type]) : [];
  const courseAudience: CourseAudience[] =
    memberTypes.includes("VOLUNTEER") || session?.roles?.includes("VOLUNTEER")
      ? ["VOLUNTEERS", "BOTH"]
      : memberTypes.length
        ? ["MEMBERS", "BOTH"]
        : ["BOTH"];

  const [events, courses] = await Promise.all([
    prisma.event.findMany({
      where: { public: true, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    prisma.course.findMany({
      where: {
        agendaVisible: true,
        startsAt: { gte: now },
        audience: { in: courseAudience },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
  ]);

  const upcoming = [
    ...events.map((event) => ({
      id: event.id,
      kind: "EVENT" as const,
      title: event.name,
      startsAt: event.startsAt,
      location: event.location,
      subtitle: "Evento público",
    })),
    ...courses.map((course) => ({
      id: course.id,
      kind: "COURSE" as const,
      title: course.title,
      startsAt: course.startsAt,
      location: course.location,
      subtitle:
        course.audience === "BOTH"
          ? "Curso para membros e voluntários"
          : course.audience === "MEMBERS"
            ? "Curso para membros"
            : "Curso para voluntários",
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const emptyLabel =
    courseAudience.includes("MEMBERS") || courseAudience.includes("VOLUNTEERS")
      ? "Nenhum evento ou curso disponível no momento."
      : "Nenhum evento público ou curso disponível no momento.";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Agenda</div>
        <div className="text-sm text-muted-foreground">
          Próximos eventos públicos e cursos liberados para você.
        </div>
      </div>

      <div className="space-y-3">
        {upcoming.length ? (
          upcoming.map((item) => (
            <Card key={`${item.kind}-${item.id}`} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {format(item.startsAt, "dd/MM/yyyy HH:mm")}
                    {item.location ? ` • ${item.location}` : ""}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{item.subtitle}</div>
                </div>
                <Badge className="shrink-0">{item.kind === "COURSE" ? "CURSO" : "EVENTO"}</Badge>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">{emptyLabel}</div>
          </Card>
        )}
      </div>
    </div>
  );
}
