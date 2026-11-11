import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CHURCH_TIME_ZONE, churchDateKey } from "@/lib/weekly-services";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { calculateNextWeekdayMeeting } from "@/server/utils/date-utils";
import { addCellPrayer, closeCellPrayer, deleteCell, registerCellMeeting } from "./actions";
import { SubmitButton } from "./SubmitButton";

const weekdayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const meetingDateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const nextDateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: CHURCH_TIME_ZONE });
const statuses: Record<string, string> = {
  "meeting-saved": "Reunião registrada.",
  "prayer-saved": "Pedido de oração registrado.",
  "prayer-closed": "Pedido de oração concluído.",
  "prayer-reopened": "Pedido de oração reaberto.",
  "invalid-meeting": "Confira a data da reunião e a quantidade de visitantes.",
  "invalid-members": "A lista de participantes mudou. Confira os membros presentes e tente novamente.",
  "invalid-prayer": "Preencha o nome e o motivo do pedido de oração.",
};

function PrayerFields({ prefix, required = false }: { prefix: string; required?: boolean }) {
  return (
    <div className="grid gap-3">
      <label htmlFor={`${prefix}-name`} className="grid gap-1 text-sm">
        Nome de quem pediu
        <Input id={`${prefix}-name`} name="requesterName" minLength={2} maxLength={160} required={required} />
      </label>
      <label htmlFor={`${prefix}-reason`} className="grid gap-1 text-sm">
        Motivo do pedido
        <textarea id={`${prefix}-reason`} name="reason" rows={3} maxLength={2000} required={required}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      </label>
    </div>
  );
}

export default async function CellDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; excluir?: string }>;
}) {
  const [{ id }, { status, excluir }, session] = await Promise.all([params, searchParams, getServerSession(authOptions)]);
  const canEdit = !!session?.permissions?.includes("cells:write");
  if (!session?.uid || (!canEdit && !session.permissions?.includes("cells:read"))) notFound();

  const cell = await prisma.cell.findUnique({
    where: { id },
    select: {
      name: true, weekday: true, time: true, address: true,
      leader: { select: { id: true, fullName: true, user: { select: { id: true } } } },
      host: { select: { id: true, fullName: true } },
      participants: { select: { id: true, fullName: true }, orderBy: { fullName: "asc" } },
      meetings: {
        orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true, meetingDate: true, visitorsCount: true, participantsCount: true, prayerRequests: true,
          attendance: { where: { present: true }, select: { member: { select: { id: true, fullName: true } } } },
        },
      },
      _count: { select: { prayerEntries: { where: { closedAt: null } } } },
    },
  });
  if (!cell) notFound();

  const canManage = canEdit || cell.leader.user?.id === session.uid;
  const prayers = canManage ? await prisma.cellPrayerRequest.findMany({
    where: { cellId: id },
    orderBy: { createdAt: "desc" },
    include: { meeting: { select: { meetingDate: true } } },
  }) : [];
  const roster = [...new Map([cell.leader, ...(cell.host ? [cell.host] : []), ...cell.participants]
    .map((member) => [member.id, member])).values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  const today = churchDateKey(new Date());
  const [latest, previous] = cell.meetings
    .filter((meeting) => meeting.meetingDate.toISOString().slice(0, 10) <= today)
    .slice(0, 2)
    .map((meeting) => meeting.participantsCount ?? meeting.attendance.length + (meeting.visitorsCount ?? 0));
  const growth = previous > 0 ? (latest - previous) / previous : null;
  const growthLabel = growth === null ? "—" : new Intl.NumberFormat("pt-BR", {
    style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero",
  }).format(growth);
  const metrics = [
    { label: "Membros vinculados", value: cell.participants.length },
    { label: "Crescimento de presença", value: growthLabel, detail: "Última reunião em relação à anterior" },
    { label: "Reuniões registradas", value: cell.meetings.length },
    { label: "Pedidos pendentes", value: cell._count.prayerEntries },
  ];
  const feedback = status && Object.hasOwn(statuses, status) ? statuses[status] : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/cells" className="text-sm underline">Voltar para células</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{cell.name}</h1>
          {canEdit ? <Link className="text-sm underline" href={`/admin/cells?edit=${id}#form-celula`}>Editar célula</Link> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Líder: {cell.leader.fullName}{cell.host ? ` · Anfitrião: ${cell.host.fullName}` : ""}
        </p>
        {cell.address ? <p className="text-sm text-muted-foreground">{cell.address}</p> : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, detail }) => (
          <Card key={label} className="p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            {detail ? <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd> : null}
          </Card>
        ))}
      </dl>
      {feedback ? <p role={status?.startsWith("invalid") ? "alert" : "status"} className="rounded-xl border border-border p-3 text-sm">{feedback}</p> : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card id="agenda" className="space-y-4 p-5">
          <h2 className="font-semibold">Agenda da célula</h2>
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="font-medium">{weekdayNames[cell.weekday]} · {cell.time}</p>
            <p className="text-muted-foreground">
              Próximo encontro semanal em {nextDateLabel.format(calculateNextWeekdayMeeting(cell.weekday, cell.time))}.
            </p>
          </div>
          <h3 className="text-sm font-medium">Reuniões registradas</h3>
          {cell.meetings.length ? (
            <ul className="space-y-2">
              {cell.meetings.map((meeting) => (
                <li key={meeting.id}>
                  <details className="rounded-xl border border-border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {meetingDateLabel.format(meeting.meetingDate)} · {meeting.attendance.length} membros presentes · {meeting.visitorsCount ?? 0} visitantes
                    </summary>
                    <div className="mt-2 space-y-2">
                      {meeting.attendance.length ? (
                        <ul className="flex flex-wrap gap-2">
                          {meeting.attendance.map(({ member }) => <li key={member.id}><Badge>{member.fullName}</Badge></li>)}
                        </ul>
                      ) : <p className="text-muted-foreground">Nenhuma presença nominal registrada.</p>}
                      {meeting.participantsCount !== null ? <p>Total informado: {meeting.participantsCount}</p> : null}
                      {canManage && meeting.prayerRequests ? (
                        <p className="whitespace-pre-wrap text-muted-foreground">Anotação de oração: {meeting.prayerRequests}</p>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhuma reunião registrada.</p>}
        </Card>

        {canManage ? (
          <Card id="registrar-reuniao" className="p-5">
            <h2 className="font-semibold">Registrar reunião</h2>
            <form action={registerCellMeeting.bind(null, id)} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">Data da reunião
                  <Input name="meetingDate" type="date" defaultValue={today} required />
                </label>
                <label className="grid gap-1 text-sm">Quantidade de visitantes
                  <Input name="visitorsCount" type="number" min={0} max={999999} defaultValue={0} required />
                </label>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Membros presentes</legend>
                <div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border p-3">
                  {roster.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="presentMemberIds" value={member.id} />
                      {member.fullName}
                    </label>
                  ))}
                </div>
              </fieldset>
              <details className="space-y-3 rounded-xl border border-border p-3" open={status === "invalid-prayer"}>
                <summary className="cursor-pointer text-sm font-medium">Incluir pedido de oração nesta reunião</summary>
                <PrayerFields prefix="meeting-prayer" />
              </details>
              <SubmitButton>Registrar reunião</SubmitButton>
            </form>
          </Card>
        ) : null}
      </div>

      {canManage ? (
        <Card id="oracao" className="space-y-4 p-5">
          <h2 className="font-semibold">Pedidos de oração</h2>
          <form action={addCellPrayer.bind(null, id)} className="max-w-xl space-y-3">
            <PrayerFields prefix="cell-prayer" required />
            <SubmitButton>Adicionar pedido</SubmitButton>
          </form>
          {prayers.length ? (
            <ul className="space-y-2">
              {[...prayers.filter((p) => !p.closedAt), ...prayers.filter((p) => p.closedAt)].map((prayer) => (
                <li key={prayer.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{prayer.requesterName}</p>
                      <Badge>{prayer.closedAt ? "Concluído" : "Pendente"}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{prayer.reason}</p>
                    {prayer.meeting ? <p className="text-xs text-muted-foreground">Reunião de {meetingDateLabel.format(prayer.meeting.meetingDate)}</p> : null}
                  </div>
                  <form action={closeCellPrayer.bind(null, id, prayer.id)}>
                    <input type="hidden" name="reopen" value={prayer.closedAt ? "1" : "0"} />
                    <SubmitButton variant="outline" size="sm">{prayer.closedAt ? "Reabrir" : "Concluir"}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum pedido registrado neste painel.</p>}
        </Card>
      ) : null}

      {canEdit ? (
        <Card id="excluir" className="p-5">
          <details className="space-y-3" open={excluir === "1"}>
            <summary className="cursor-pointer text-sm font-semibold text-destructive">Excluir célula</summary>
            <p className="text-sm">A exclusão remove as reuniões, as presenças e os pedidos de oração desta célula. Os cadastros dos membros são mantidos.</p>
            <form action={deleteCell.bind(null, id)}>
              <SubmitButton variant="destructive">Confirmar exclusão</SubmitButton>
            </form>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
