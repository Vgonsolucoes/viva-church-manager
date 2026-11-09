import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/server/db";
import { ensureWeeklyServices } from "@/server/weekly-services";
import { ensureStaffingSchedules } from "@/server/staffing";
import { staffingMonth, staffingMonthRange, staffingState } from "@/lib/staffing";
import { createSchedule, removeAssignment } from "./actions";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { AssignmentForm, StaffingControls } from "./StaffingForms";
export const dynamic = "force-dynamic";
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const monthLabel = (key: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(key + "-01T12:00:00Z"));
function toLocalInputValue(date: Date) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(" ", "T"); }
const statusLabels: Record<string, string> = { PENDING: "Aguardando confirmação", CONFIRMED: "Confirmado", DECLINED: "Recusado", SUBSTITUTE_REQUESTED: "Substituição solicitada", NO_SHOW: "Faltou" };
export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ month?: string; focus?: string }> }) {
  const [query, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  const now = new Date();
  const currentMonth = staffingMonth(now);
  const selectedMonth = query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : currentMonth;
  const { from, to } = staffingMonthRange(selectedMonth);
  const canWrite = hasPermission(session?.permissions ?? [], "schedules:write");
  await ensureWeeklyServices();
  await ensureStaffingSchedules(now);
  const [schedules, volunteers, ministries, dates] = await Promise.all([
    prisma.schedule.findMany({ where: { startsAt: { gte: from, lt: to } }, orderBy: { startsAt: "asc" }, include: { ministry: true, event: true, course: true, assignments: { include: { substitutionRequests: { where: { status: { in: ["REQUESTED", "VOLUNTEER_B_ACCEPTED"] } } }, ministry: true, volunteer: { include: { member: true } } } } } }),
    canWrite ? prisma.volunteerProfile.findMany({ orderBy: { member: { fullName: "asc" } }, include: { member: { include: { memberMinistries: true } } } }) : [],
    prisma.ministry.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.schedule.findMany({ select: { startsAt: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const months = new Map<string, number>();
  for (const row of dates) { const month = staffingMonth(row.startsAt); months.set(month, (months.get(month) ?? 0) + 1); }
  const volunteerOptions = volunteers.map(v => ({ id: v.id, name: v.member.fullName, ministryIds: [...new Set([v.ministryId, v.member.ministryId, ...v.member.memberMinistries.map(link => link.ministryId)].filter((id): id is string => Boolean(id)))] }));
  const pending = schedules.filter(s => ["pending", "review"].includes(staffingState(s).key)).length;
  const drafting = schedules.filter(s => staffingState(s).key === "draft").length;
  const completed = schedules.filter(s => staffingState(s).key === "complete").length;
  return <div className="space-y-6">
    <header><h1 className="text-xl font-semibold tracking-tight">Escalas e pendências</h1><p className="mt-1 text-sm text-muted-foreground">Cultos, eventos e cursos com execução prevista entram aqui para montar a equipe de voluntários.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><h2 className="font-semibold capitalize">{monthLabel(selectedMonth)}</h2><span className="text-sm text-muted-foreground">{schedules.length} escalas neste mês</span>{selectedMonth !== currentMonth ? <Link href="/admin/schedules" className="text-sm font-semibold text-primary">Voltar ao mês atual</Link> : null}</div>
    <div className="grid gap-3 sm:grid-cols-3">{[["Pendentes / revisar", pending], ["Em montagem", drafting], ["Montagem concluída", completed]].map(([label, count]) => <Card key={label} className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{count}</div></Card>)}</div>
    <details className="rounded-2xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Expandir outros meses ({[...months.keys()].filter(month => month !== selectedMonth).length})</summary><div className="mt-3 flex flex-wrap gap-2">{[...months.entries()].filter(([month]) => month !== selectedMonth).map(([month, count]) => <Link key={month} href={"/admin/schedules?month=" + month} className="rounded-xl border border-border px-3 py-2 text-sm capitalize hover:bg-muted/20">{monthLabel(month)} · {count} escalas</Link>)}{months.size <= 1 ? <p className="text-sm text-muted-foreground">Sem escalas em outros meses.</p> : null}</div></details>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3"><div className="space-y-4 xl:col-span-2">
      {schedules.length ? schedules.map(s => {
        const state = staffingState(s);
        const automatic = s.id.startsWith("staffing-");
        const source = s.courseId ? "Curso" : s.event?.type === "SERVICE" ? "Culto" : s.eventId ? "Evento" : ({ SERVICE: "Culto", EVENT: "Evento", CELL: "Célula", MEETING: "Reunião", REHEARSAL: "Ensaio", OTHER: "Outro" } as Record<string,string>)[s.kind];
        const showCoverage = source === "Culto" || source === "Evento";
        const counts = new Map<string | null, { name: string; volunteers: Set<string> }>();
        for (const assignment of s.assignments) {
          if (assignment.status === "DECLINED" || assignment.status === "NO_SHOW") continue;
          const ministry = assignment.ministry ?? s.ministry;
          const ministryId = ministry?.id ?? null;
          const count = counts.get(ministryId) ?? {
            name: ministry?.name ?? "Sem ministério informado",
            volunteers: new Set<string>(),
          };
          count.volunteers.add(assignment.volunteerId);
          counts.set(ministryId, count);
        }
        return <Card key={s.id} id={"schedule-" + s.id} className={"scroll-mt-5 p-5 " + (query.focus === s.id ? "ring-2 ring-primary" : "")}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge>{source}</Badge><Badge>{state.label}</Badge></div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-xs text-muted-foreground">{dateFormat.format(s.startsAt)}{s.ministry ? " · " + s.ministry.name : ""}</p></div>{canWrite && !automatic ? <ScheduleEditModal schedule={{ id: s.id, title: s.title, kind: s.kind, startsAtLocal: toLocalInputValue(s.startsAt), ministryId: s.ministryId, assignmentsCount: s.assignments.length }} ministries={s.ministry && !ministries.some(m => m.id === s.ministryId) ? [...ministries, { id: s.ministry.id, name: s.ministry.name + " (inativo)" }] : ministries} /> : null}</div>
          {automatic ? <p className="mt-2 text-xs text-muted-foreground">Vinculada ao {s.courseId ? "curso" : "culto / evento"}. O título e a data acompanham o cadastro de origem.</p> : null}
          {showCoverage ? (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Cobertura por ministério</h4>
              <p className="text-xs text-muted-foreground">Mínimo de 1 voluntário por ministério ativo.</p>
              {ministries.length ? (
                <ul className="flex flex-wrap gap-2">
                  {ministries.map((ministry) => {
                    const count = counts.get(ministry.id)?.volunteers.size ?? 0;
                    return (
                      <li key={ministry.id}>
                        <Badge className={count
                          ? "gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "gap-1.5 border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"}>
                          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
                          {ministry.name} · {count ? `${count} ${count === 1 ? "escalado" : "escalados"}` : "Sem voluntário"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-xs text-muted-foreground">Nenhum ministério ativo cadastrado.</p>}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...counts.entries()].map(([id, { name, volunteers }]) => (
                <Badge key={id ?? "unassigned"}>{name}: {volunteers.size} voluntário(s)</Badge>
              ))}
            </div>
          )}
          <div className="mt-3 space-y-2">{s.assignments.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/10 px-3 py-2"><div><div className="text-sm font-medium">{a.volunteer.member.fullName}</div><p className="text-xs text-muted-foreground">{a.ministry?.name ?? s.ministry?.name ?? "Sem ministério informado"} · {a.roleName}</p></div><div className="flex items-center gap-2"><Badge>{a.substitutionRequests.length ? "Substituição solicitada" : statusLabels[a.status] ?? a.status}</Badge>{canWrite ? <form action={removeAssignment}><input type="hidden" name="assignmentId" value={a.id} /><Button type="submit" size="sm" variant="ghost" aria-label={"Remover " + a.volunteer.member.fullName}>Remover</Button></form> : null}</div></div>)}{!s.assignments.length ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Equipe ainda não escalada. Selecione o ministério e os voluntários que vão servir.</p> : null}</div>
          {canWrite && <><AssignmentForm scheduleId={s.id} defaultMinistryId={s.ministryId} ministries={ministries} volunteers={volunteerOptions} /><StaffingControls scheduleId={s.id} completed={state.key === "complete"} /></>}
          {!showCoverage && <p className="mt-3 text-xs text-muted-foreground">Quantidade mínima por ministério: aguardando definição.</p>}
        </Card>;
      }) : <Card className="p-6 text-sm text-muted-foreground">Nenhuma escala neste mês.</Card>}
    </div>
      {canWrite ? <>
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
      </> : null}
    </div>
  </div>;
}
