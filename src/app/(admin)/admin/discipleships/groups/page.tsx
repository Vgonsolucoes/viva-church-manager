import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/app/(admin)/admin/cells/[id]/SubmitButton";
import { churchDateKey } from "@/lib/weekly-services";
import { prisma } from "@/server/db";
import { selectedMonth, monthlySession } from "@/server/discipleship-monthly";
import { saveGroupMeeting } from "./actions";
import { MonthlyDiscipleshipMaterial } from "./MonthlyMaterial";

export const dynamic = "force-dynamic";
const feedback: Record<string, string> = {
  "material-saved": "PDF publicado para os discipuladores da sua rede.",
  "meeting-saved": "Presenças e ausências registradas. Os indicadores foram atualizados.",
  "invalid-pdf": "Envie um arquivo PDF válido de até 8 MB e informe o título.",
  "invalid-meeting": "Confira os dados. A data do encontro deve pertencer ao mês selecionado.",
  "roster-changed": "A lista de discípulos foi alterada. Atualize a página e confira as presenças.",
};
export default async function GroupMeetingPage({ searchParams }: {
  searchParams: Promise<{ month?: string; status?: string; leader?: string }>;
}) {
  const params = await searchParams;
  const month = selectedMonth(params.month);
  const { session, context, isSuperAdmin } = await monthlySession(params.leader);
  if (!context) return (
    <div className="space-y-4">
      <Link href="/admin/discipleships" className="text-sm underline">Voltar para discipulados</Link>
      <h1 className="text-2xl font-semibold">Encontro em Grupo</h1>
      <Card className="p-5">{isSuperAdmin ? "Nenhum discipulador ou encontro em grupo cadastrado ainda." : "Esta área está disponível aos discipuladores com discípulos ativos na sua rede."}</Card>
    </div>
  );
  const group = await prisma.discipleshipGroupMeeting.findUnique({
    where: { leaderId_month: { leaderId: context.leaderId, month } },
    include: { meetings: { include: { discipleship: { include: { disciple: { select: { fullName: true } } } } } } },
  });
  const current = group ? [] : await prisma.discipleship.findMany({
    where: { status: "ACTIVE", OR: [{ disciplerId: context.leaderId }, { coDisciplerId: context.leaderId }] },
    include: { disciple: { select: { fullName: true } } },
    orderBy: { disciple: { fullName: "asc" } },
  });
  const roster = group
    ? group.meetings.map((m) => ({ id: m.discipleshipId, name: m.discipleship.disciple.fullName, present: m.attendance === true }))
    : current.map((bond) => ({ id: bond.id, name: bond.disciple.fullName, present: false }));
  const canWrite = isSuperAdmin || session.permissions?.some((p) => ["discipleship:my:write", "discipleships:write"].includes(p));
  const today = churchDateKey(new Date());
  const date = group ? churchDateKey(group.meetingAt) : today.startsWith(month) ? today : `${month}-01`;
  const presentCount = roster.filter((p) => p.present).length;
  return (
    <div className="space-y-5">
      <Link href={`/admin/discipleships?month=${month}&leader=${context.leaderId}`} className="text-sm underline">Voltar para discipulados</Link>
      <h1 className="text-2xl font-semibold">Encontro em Grupo</h1>
      <MonthlyDiscipleshipMaterial month={month} leaderId={context.leaderId} groups />
      {params.status && Object.hasOwn(feedback, params.status) ? (
        <p role={params.status.includes("saved") ? "status" : "alert"} className="rounded-xl border border-border p-3 text-sm">{feedback[params.status]}</p>
      ) : null}
      <dl className="grid grid-cols-3 gap-3">
        {[["Discípulos", roster.length], ["Presentes", group ? presentCount : "—"], ["Ausentes", group ? roster.length - presentCount : "—"]].map(([label, value]) => (
          <Card key={label} className="p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold">{value}</dd></Card>
        ))}
      </dl>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">{group ? "Encontro mensal registrado" : "Registrar encontro do mês"}</h2>
        <p className="text-sm text-muted-foreground">Marque os discípulos presentes. Ao salvar, os demais serão registrados como ausentes. Cada mês tem um encontro por discipulador ou casal.</p>
        <form action={saveGroupMeeting} className="space-y-4" key={month}>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="leader" value={context.leaderId} />
          <label className="grid max-w-sm gap-1 text-sm">Data do encontro
            <Input name="date" type="date" defaultValue={date} required disabled={!canWrite} />
          </label>
          <fieldset className="space-y-3" disabled={!canWrite}>
            <legend className="text-sm font-medium">Presença dos discípulos da sua rede direta</legend>
            {roster.map((person) => (
              <label key={person.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                <input type="hidden" name="bondIds" value={person.id} />
                <input type="checkbox" name="present" value={person.id} defaultChecked={person.present} />
                {person.name}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1 text-sm">Observações
            <textarea name="notes" defaultValue={group?.notes ?? ""} rows={3} maxLength={3000} disabled={!canWrite}
              className="rounded-xl border border-border bg-background px-3 py-2" />
          </label>
          {canWrite && roster.length ? <SubmitButton>{group ? "Atualizar presenças" : "Salvar encontro e presenças"}</SubmitButton> : null}
        </form>
      </Card>
    </div>
  );
}
