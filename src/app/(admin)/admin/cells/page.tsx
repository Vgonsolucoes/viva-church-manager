import { assertWebPermission } from "@/server/access-control";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
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

const participantsChanged = new Error("Participantes já vinculados a outra célula.");
const cellsPath = "/admin/cells";
const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const cellSchema = z.object({
  name: z.string().trim().min(2),
  leaderId: z.string().min(1),
  hostId: z.string().optional().or(z.literal("")),
  address: z.string().trim(),
  leaderWhatsapp: z.string().trim().regex(/^[+\d().\s-]*$/).transform((value) => {
    const digits = value.replace(/\D/g, "");
    return !value ? null : !value.startsWith("+") && (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
  }).refine((value) => value === null || /^[1-9]\d{7,14}$/.test(value)),
  weekday: z.string().regex(/^[0-6]$/).transform(Number),
  time: z.string().trim().min(1),
});

async function saveCell(cellId: string | null, formData: FormData) {
  "use server";
  const session = await assertWebPermission("cells:write");
  const parsed = cellSchema.safeParse(Object.fromEntries(formData));
  const editPath = cellId ? `${cellsPath}?edit=${encodeURIComponent(cellId)}` : cellsPath;
  const errorPath = `${editPath}${cellId ? "&" : "?"}erro=1#form-celula`;
  if (!parsed.success) redirect(errorPath);

  const data = { ...parsed.data, hostId: parsed.data.hostId || null, address: parsed.data.address || null };
  const participantIds = z.array(z.string().min(1)).parse(formData.getAll("participantIds"));
  const uniqueIds = [...new Set(participantIds)];
  const cell = await prisma.$transaction(async (tx) => {
    const saved = cellId
      ? await tx.cell.update({ where: { id: cellId }, data })
      : await tx.cell.create({ data });
    const assigned = await tx.member.updateMany({
      where: { id: { in: uniqueIds }, OR: [{ cellId: null }, { cellId: saved.id }] },
      data: { cellId: saved.id, participatesInCell: true },
    });
    if (assigned.count !== uniqueIds.length) throw participantsChanged;
    await tx.member.updateMany({
      where: { cellId: saved.id, id: { notIn: uniqueIds } },
      data: { cellId: null, participatesInCell: false },
    });
    return saved;
  }).catch((error: unknown) => {
    if (error === participantsChanged) redirect(errorPath);
    throw error;
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: cellId ? "UPDATE" : "CREATE",
    entityType: "Cell",
    entityId: cell.id,
    after: { id: cell.id, name: cell.name, leaderId: cell.leaderId },
  });

  revalidatePath(cellsPath);
  redirect(`${cellsPath}?salvo=1`);
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
  await assertWebPermission("cells:write");

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

export default async function CellsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; erro?: string; salvo?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  const canEdit = session?.permissions?.includes("cells:write");
  const editId = canEdit && typeof params.edit === "string" ? params.edit : undefined;
  const [members, cells, editing] = await Promise.all([
    prisma.member.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, cellId: true },
    }),
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
    editId ? prisma.cell.findUnique({ where: { id: editId } }) : null,
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
      {params.salvo === "1" ? <p role="status">Célula salva com sucesso.</p> : null}

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
                    <div className="flex items-center gap-2">
                      <Badge className="shrink-0">{c.meetings.length} reuniões (últimas)</Badge>
                      {canEdit ? (
                        <Link className="text-sm font-medium underline" href={`${cellsPath}?edit=${c.id}#form-celula`}>
                          Editar<span className="sr-only"> {c.name}</span>
                        </Link>
                      ) : null}
                    </div>
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

        {canEdit ? <Card id="form-celula" className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{editing ? "Editar célula" : "Nova célula"}</h2>
            {editing ? <Link href={cellsPath} className="text-sm underline">Cancelar</Link> : null}
          </div>
          {params.erro === "1" ? (
            <p role="alert" className="mt-3 text-sm">Não foi possível salvar. Confira os campos e se os participantes ainda estão disponíveis.</p>
          ) : null}
          <form key={editing?.id ?? "new"} action={saveCell.bind(null, editing?.id ?? null)} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Nome da célula</div>
              <Input aria-label="Nome da célula" name="name" defaultValue={editing?.name} placeholder="Ex: Célula Central" minLength={2} required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Líder</div>
              <select
                name="leaderId"
                aria-label="Líder da célula"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                required
                defaultValue={editing?.leaderId ?? ""}
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
                aria-label="Anfitrião"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue={editing?.hostId ?? ""}
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
              <Input aria-label="Endereço da célula" name="address" defaultValue={editing?.address ?? ""} placeholder="Rua, número, bairro e cidade" />
            </div>
            <div className="space-y-2">
              <label htmlFor="cell-whatsapp" className="text-xs font-medium text-muted-foreground">WhatsApp do líder</label>
              <Input id="cell-whatsapp" name="leaderWhatsapp" type="tel" defaultValue={editing?.leaderWhatsapp ? `+${editing.leaderWhatsapp}` : ""} placeholder="(11) 99999-9999" />
              <p className="text-xs text-muted-foreground">Disponível no app para as pessoas vinculadas à célula.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Dia</div>
                <select
                  name="weekday"
                  aria-label="Dia da semana"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue={String(editing?.weekday ?? 2)}
                >
                  {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Horário</div>
                <Input aria-label="Horário" name="time" defaultValue={editing?.time} placeholder="19:30" required />
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Vincular participantes</summary>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-xl border border-border p-3">
                {members.filter((member) => !member.cellId || member.cellId === editing?.id).map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="participantIds" value={member.id} defaultChecked={!!editing && member.cellId === editing.id} />
                    {member.fullName}
                  </label>
                ))}
              </div>
            </details>
            <Button className="w-full" type="submit">
              {editing ? "Salvar alterações" : "Criar célula"}
            </Button>
          </form>
        </Card> : null}
      </div>
    </div>
  );
}

