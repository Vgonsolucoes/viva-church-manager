import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const createScheduleSchema = z.object({
  title: z.string().min(2),
  kind: z.enum(["SERVICE", "EVENT", "CELL", "MEETING", "REHEARSAL", "OTHER"]).default("SERVICE"),
  startsAt: z.string().min(5),
  ministryName: z.string().optional().or(z.literal("")),
});

async function createSchedule(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createScheduleSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    startsAt: formData.get("startsAt"),
    ministryName: formData.get("ministryName"),
  });
  if (!parsed.success) return;

  const ministry =
    parsed.data.ministryName && parsed.data.ministryName.trim().length
      ? await prisma.ministry.upsert({
          where: { name: parsed.data.ministryName.trim() },
          update: {},
          create: { name: parsed.data.ministryName.trim() },
        })
      : null;

  const schedule = await prisma.schedule.create({
    data: {
      title: parsed.data.title.trim(),
      kind: parsed.data.kind,
      startsAt: new Date(parsed.data.startsAt),
      ministryId: ministry?.id ?? null,
      createdById: session?.uid ?? null,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Schedule",
    entityId: schedule.id,
    after: { id: schedule.id, title: schedule.title, startsAt: schedule.startsAt },
  });

  revalidatePath("/admin/schedules");
}

const addAssignmentSchema = z.object({
  scheduleId: z.string().min(1),
  volunteerId: z.string().min(1),
  roleName: z.string().min(2),
});

async function addAssignment(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = addAssignmentSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    volunteerId: formData.get("volunteerId"),
    roleName: formData.get("roleName"),
  });
  if (!parsed.success) return;

  const assignment = await prisma.scheduleAssignment.create({
    data: {
      scheduleId: parsed.data.scheduleId,
      volunteerId: parsed.data.volunteerId,
      roleName: parsed.data.roleName.trim(),
      status: "PENDING",
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "ScheduleAssignment",
    entityId: assignment.id,
    after: {
      id: assignment.id,
      scheduleId: assignment.scheduleId,
      volunteerId: assignment.volunteerId,
      roleName: assignment.roleName,
    },
  });

  revalidatePath("/admin/schedules");
}

export default async function SchedulesPage() {
  const [schedules, volunteers] = await Promise.all([
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
              schedules.map((s) => (
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
                    <Badge>{s.assignments.length} alocados</Badge>
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
                      {volunteers.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.member.fullName}
                        </option>
                      ))}
                    </select>
                    <Input name="roleName" placeholder="Função (ex: Som)" required />
                    <Button type="submit" variant="secondary">
                      Alocar
                    </Button>
                  </form>
                </div>
              ))
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
              <Input name="ministryName" placeholder="Ex: Boas-vindas" />
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
