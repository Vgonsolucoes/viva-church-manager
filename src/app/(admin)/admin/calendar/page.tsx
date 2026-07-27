import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CalendarAdminPage() {
  const now = new Date();
  const [events, schedules, courses] = await Promise.all([
    prisma.event.findMany({ where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 20 }),
    prisma.schedule.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { ministry: true },
    }),
    prisma.course.findMany({
      where: { agendaVisible: true, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
  ]);

  const items = [
    ...events.map((e) => ({
      id: e.id,
      kind: "EVENT",
      title: e.name,
      startsAt: e.startsAt,
      meta: e.type,
    })),
    ...schedules.map((s) => ({
      id: s.id,
      kind: "SCHEDULE",
      title: s.title,
      startsAt: s.startsAt,
      meta: s.ministry?.name ?? s.kind,
    })),
    ...courses.map((c) => ({
      id: c.id,
      kind: "COURSE",
      title: c.title,
      startsAt: c.startsAt,
      meta: c.location ?? (c.audience === "BOTH" ? "Membros e voluntários" : c.audience),
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Agenda</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Visão unificada de cultos, eventos, escalas e cursos lançados.
        </div>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium">Próximos itens</div>
        <div className="mt-4 divide-y divide-border">
          {items.length ? (
            items.map((it) => (
              <div key={`${it.kind}-${it.id}`} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{it.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(it.startsAt)}{" "}
                    • {it.meta}
                  </div>
                </div>
                <Badge className="shrink-0">{it.kind}</Badge>
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-muted-foreground">
              Nenhum item cadastrado.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
