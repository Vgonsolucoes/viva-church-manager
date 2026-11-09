"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RaffleForm({ action, children, label }: {
  action: (form: FormData) => Promise<string | void>;
  children?: ReactNode;
  label: string;
}) {
  const [error, submit, pending] = useActionState(async (_: string, form: FormData) => (await action(form)) ?? "", "");
  return (
    <form action={submit} className="space-y-3">
      {children}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando…" : label}</Button>
    </form>
  );
}

export function ParticipantFields({ members }: { members: { id: string; fullName: string }[] }) {
  const [memberId, setMemberId] = useState("");
  return (
    <>
      <label className="block space-y-1 text-sm">
        <span>Membro cadastrado</span>
        <select name="memberId" value={memberId} onChange={(event) => setMemberId(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3">
          <option value="">Participante sem vínculo</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Nome do participante</span>
        {memberId
          ? <><Input readOnly value={members.find((member) => member.id === memberId)?.fullName ?? ""} /><input type="hidden" name="participantName" value="" /></>
          : <Input name="participantName" maxLength={160} required />}
      </label>
    </>
  );
}
