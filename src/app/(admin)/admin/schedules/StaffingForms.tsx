"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { addAssignment, changeStaffingState, type ScheduleFormState } from "./actions";

const initial: ScheduleFormState = { ok: false, message: "", error: "" };
type Ministry = { id: string; name: string };
type Volunteer = { id: string; name: string; ministryIds: string[] };
export function AssignmentForm({ scheduleId, defaultMinistryId, ministries, volunteers }: { scheduleId: string; defaultMinistryId: string | null; ministries: Ministry[]; volunteers: Volunteer[] }) {
  const [state, action, pending] = useActionState(addAssignment, initial);
  const [ministryId, setMinistryId] = useState(defaultMinistryId ?? "");
  const options = volunteers.filter(v => v.ministryIds.includes(ministryId));
  return <form action={action} className="mt-4 space-y-3 rounded-xl border border-border bg-background p-3">
    <input type="hidden" name="scheduleId" value={scheduleId} />
    <div className="text-sm font-medium">Adicionar voluntário à equipe</div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-xs text-muted-foreground">Ministério<select required name="ministryId" value={ministryId} onChange={event => setMinistryId(event.target.value)} className="block h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o ministério</option>{ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="space-y-1 text-xs text-muted-foreground">Voluntário<select key={ministryId} required name="volunteerId" disabled={!ministryId} defaultValue="" className="block h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o voluntário</option>{options.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label className="space-y-1 text-xs text-muted-foreground">Função<Input required minLength={2} maxLength={80} name="roleName" placeholder="Ex.: recepção, sala Kids, som" /></label>
      <Button disabled={pending || !options.length} type="submit" variant="secondary" className="self-end">{pending ? "Alocando..." : "Alocar voluntário"}</Button>
    </div>
    {ministryId && !options.length ? <p className="text-xs text-muted-foreground">Nenhum voluntário vinculado a este ministério. Confira os cadastros de Voluntários e Membros.</p> : null}
    {state.error || state.message ? <p role={state.error ? "alert" : "status"} className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{state.error || state.message}</p> : null}
  </form>;
}
export function StaffingControls({ scheduleId, completed }: { scheduleId: string; completed: boolean }) {
  const [state, action, pending] = useActionState(changeStaffingState, initial);
  return <form action={action} className="mt-4 flex flex-wrap items-center justify-end gap-3">
    <input type="hidden" name="scheduleId" value={scheduleId} /><input type="hidden" name="intent" value={completed ? "reopen" : "complete"} />
    <Button type="submit" variant={completed ? "outline" : "secondary"} disabled={pending}>{pending ? "Salvando..." : completed ? "Reabrir montagem" : "Concluir montagem"}</Button>
    {state.error || state.message ? <p role={state.error ? "alert" : "status"} className={`w-full text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}>{state.error || state.message}</p> : null}
  </form>;
}
