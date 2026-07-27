import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const createCellSchema = z.object({
  name: z.string().min(2),
  leaderId: z.string().min(1),
  hostId: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  weekday: z.string().min(1),
  time: z.string().min(1),
});

async function createCell(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createCellSchema.safeParse({
    name: formData.get("name"),
    leaderId: formData.get("leaderId"),
    hostId: formData.get("hostId"),
    address: formData.get("address"),
    weekday: formData.get("weekday"),
    time: formData.get("time"),
  });
  if (!parsed.success) return;

  const cell = await prisma.cell.create({
    data: {
      name: parsed.data.name.trim(),
      leaderId: parsed.data.leaderId,
      hostId: parsed.data.hostId ? parsed.data.hostId : null,
      address: parsed.data.address ? parsed.data.address.trim() : null,
      weekday: Number(parsed.data.weekday),
      time: parsed.data.time.trim(),
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Cell",
    entityId: cell.id,
    after: { id: cell.id, name: cell.name, leaderId: cell.leaderId },
  });

  revalidatePath("/admin/cells");
}

const createMeetingSchema = z.object({
  cellId: z.string().min(1),
  meetingDate: z.string().min(5),
  participantsCount: z.string().optional().or(z.literal("")),
  visitorsCount: z.string().optional().or(z.literal("")),
  prayerRequests: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

async function createMeeting(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createMeetingSchema.safeParse({
    cellId: formData.get("cellId"),
    meetingDate: formData.get("meetingDate"),
    participantsCount: formData.get("participantsCount"),
    visitorsCount: formData.get("visitorsCount"),
    prayerRequests: formData.get("prayerRequests"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;

  const presentMemberIds = formData.getAll("presentMemberIds").map((v) => String(v));

  const meeting = await prisma.cellMeeting.create({
    data: {
      cellId: parsed.data.cellId,
      meetingDate: new Date(parsed.data.meetingDate),
      participantsCount: parsed.data.participantsCount
        ? Number(parsed.data.participantsCount)
        : null,
      visitorsCount: parsed.data.visitorsCount ? Number(parsed.data.visitorsCount) : null,
      prayerRequests: parsed.data.prayerRequests ? parsed.data.prayerRequests.trim() : null,
      notes: parsed.data.notes ? parsed.data.notes.trim() : null,
      attendance: {
        create: presentMemberIds.map((memberId) => ({ memberId, present: true })),
      },
    },
    include: { attendance: true },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "CellMeeting",
    entityId: meeting.id,
    after: {
      id: meeting.id,
      cellId: meeting.cellId,
      meetingDate: meeting.meetingDate,
      attendanceCount: meeting.attendance.length,
    },
  });

  revalidatePath("/admin/cells");
}

export default async function CellsPage() {
  const [members, cells] = await Promise.all([
    prisma.member.findMany({ orderBy: { fullName: "asc" }, take: 800 }),
    prisma.cell.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        leader: true,
        host: true,
        meetings: {
          orderBy: { meetingDate: "desc" },
          take: 6,
          include: { attendance: { include: { member: true } } },
        },
      },
    }),
  ]);

  const weekdayLabel = (w: number) =>
    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][w] ?? String(w);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Células</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Gestão de células, reuniões, presença e pedidos de oração.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Células cadastradas</div>
            <div className="text-xs text-muted-foreground">{cells.length} exibidas</div>
          </div>
          <div className="mt-4 space-y-3">
            {cells.length ? (
              cells.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Líder: {c.leader.fullName}
                        {c.host ? ` • Anfitrião: ${c.host.fullName}` : ""} •{" "}
                        {weekdayLabel(c.weekday)} • {c.time}
                        {c.address ? ` • ${c.address}` : ""}
                      </div>
                    </div>
                    <Badge className="shrink-0">{c.meetings.length} reuniões (últimas)</Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    {c.meetings.length ? (
                      c.meetings.map((m) => (
                        <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold">
                              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                                m.meetingDate,
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>
                                Presentes:{" "}
                                {m.participantsCount ?? m.attendance.length ?? 0}
                              </span>
                              <span>Visitantes: {m.visitorsCount ?? 0}</span>
                            </div>
                          </div>
                          {m.prayerRequests ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Pedidos: {m.prayerRequests}
                            </div>
                          ) : null}
                          {m.attendance.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {m.attendance.slice(0, 12).map((a) => (
                                <Badge key={a.id}>{a.member.fullName}</Badge>
                              ))}
                              {m.attendance.length > 12 ? (
                                <Badge>+{m.attendance.length - 12}</Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma reunião registrada ainda.
                      </div>
                    )}
                  </div>

                  <form action={createMeeting} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
                    <input type="hidden" name="cellId" value={c.id} />
                    <Input name="meetingDate" type="date" required className="md:col-span-1" />
                    <Input
                      name="participantsCount"
                      placeholder="Presentes"
                      className="md:col-span-1"
                    />
                    <Input
                      name="visitorsCount"
                      placeholder="Visitantes"
                      className="md:col-span-1"
                    />
                    <Input
                      name="prayerRequests"
                      placeholder="Pedidos de oração"
                      className="md:col-span-2"
                    />
                    <Button type="submit" variant="secondary" className="md:col-span-1">
                      Registrar
                    </Button>
                    <div className="md:col-span-6">
                      <div className="text-xs font-medium text-muted-foreground">
                        Presença (membros)
                      </div>
                      <select
                        name="presentMemberIds"
                        multiple
                        className="mt-2 h-32 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </form>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma célula cadastrada.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Nova célula</div>
          <form action={createCell} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Nome da célula</div>
              <Input name="name" placeholder="Ex: Célula Central" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Líder</div>
              <select
                name="leaderId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecionar membro
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Anfitrião</div>
              <select
                name="hostId"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">(opcional)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Endereço</div>
              <Input name="address" placeholder="Rua / bairro" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Dia</div>
                <select
                  name="weekday"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue="2"
                >
                  <option value="0">Domingo</option>
                  <option value="1">Segunda</option>
                  <option value="2">Terça</option>
                  <option value="3">Quarta</option>
                  <option value="4">Quinta</option>
                  <option value="5">Sexta</option>
                  <option value="6">Sábado</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Horário</div>
                <Input name="time" placeholder="19:30" required />
              </div>
            </div>
            <Button className="w-full" type="submit">
              Criar célula
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

