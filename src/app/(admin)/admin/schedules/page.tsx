import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db";
import { addAssignment, createSchedule } from "./actions";
import { ScheduleEditModal } from "./ScheduleEditModal";

export const dynamic = "force-dynamic";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function SchedulesPage() {
  const [schedules, volunteers, ministries] = await Promise.all([
    prisma.schedule.findMany({
      orderBy: { startsAt: "asc" },
      take: 25,
      include: {
        ministry: true,
        assignments: { include: { volunteer: { include: { member: true } } } },
      },
    }),
    prisma.volunteerProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { member: true },
    }),
    prisma.ministry.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Escalas</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Crie escalas por data e aloque voluntários (com confirmação).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Próximas escalas</div>
            <div className="text-xs text-muted-foreground">{schedules.length} exibidos</div>
          </div>

          <div className="mt-4 space-y-3">
            {schedules.length ? (
              schedules.map((s) => {
                const ministryVolunteers = s.ministryId
                  ? volunteers.filter((v) => v.ministryId === s.ministryId)
                  : [];
                const otherVolunteers = s.ministryId
                  ? volunteers.filter((v) => v.ministryId !== s.ministryId)
                  : volunteers;
                const editMinistries =
                  s.ministry && !ministries.some((m) => m.id === s.ministry!.id)
                    ? [
                        ...ministries,
                        { id: s.ministry.id, name: `${s.ministry.name} (inativo)` },
                      ]
                    : ministries;

                return (
                  <div key={s.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(s.startsAt)}
                          {s.ministry?.name ? ` • ${s.ministry.name}` : ""} • {s.kind}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge>{s.assignments.length} alocados</Badge>
                        <ScheduleEditModal
                          schedule={{
                            id: s.id,
                            title: s.title,
                            kind: s.kind,
                            startsAtLocal: toLocalInputValue(s.startsAt),
                            ministryId: s.ministryId,
                            assignmentsCount: s.assignments.length,
                          }}
                          ministries={editMinistries}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {s.assignments.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {a.volunteer.member.fullName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {a.roleName}
                            </div>
                          </div>
                          <Badge className="shrink-0">{a.status}</Badge>
                        </div>
                      ))}
                    </div>

                    <form action={addAssignment} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                      <input type="hidden" name="scheduleId" value={s.id} />
                      <select
                        name="volunteerId"
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm md:col-span-2"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Selecionar voluntário
                        </option>
                        {ministryVolunteers.length ? (
                          <optgroup label="Voluntários do ministério">
                            {ministryVolunteers.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.member.fullName}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {otherVolunteers.length ? (
                          <optgroup
                            label={
                              ministryVolunteers.length
                                ? "Outros voluntários"
                                : "Voluntários"
                            }
                          >
                            {otherVolunteers.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.member.fullName}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                      <Input name="roleName" placeholder="Função (ex: Som)" required />
                      <Button type="submit" variant="secondary">
                        Alocar
                      </Button>
                    </form>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhuma escala cadastrada ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Nova escala</div>
          <form action={createSchedule} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Título</div>
              <Input name="title" placeholder="Ex: Culto Domingo Noite" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tipo</div>
              <select
                name="kind"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue="SERVICE"
              >
                <option value="SERVICE">Culto</option>
                <option value="EVENT">Evento</option>
                <option value="CELL">Célula</option>
                <option value="MEETING">Reunião</option>
                <option value="REHEARSAL">Ensaio</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Data e hora</div>
              <Input name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ministério</div>
              <select
                name="ministryId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">Selecione um Ministério</option>
                {ministries.map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted-foreground">
                Somente ministérios ativos cadastrados em Ministérios.
              </div>
            </div>
            <Button className="w-full" type="submit">
              Criar escala
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
