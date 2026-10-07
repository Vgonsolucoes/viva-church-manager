"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LeaderPicker, type LeaderPickerMember } from "./LeaderPicker";
import { createMinistry, updateMinistry } from "./actions";

export function MinistryFormClient(props: {
  submitLabel: string;
  members: LeaderPickerMember[];
  defaultValues?: Partial<{
    ministryId: string;
    name: string;
    description: string | null;
    active: boolean;
    leaderId: string | null;
  }>;
}) {
  const isEdit = Boolean(
    typeof props.defaultValues?.ministryId === "string" &&
      props.defaultValues.ministryId.length > 0,
  );
  const serverAction = isEdit ? updateMinistry : createMinistry;
  const [actionState, formAction, isPending] = useActionState(serverAction, { ok: false });
  const [active, setActive] = useState(props.defaultValues?.active ?? true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isEdit && actionState.ok) {
      formRef.current?.reset();
    }
  }, [actionState.ok, isEdit]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {isEdit ? (
        <input type="hidden" name="ministryId" value={props.defaultValues?.ministryId ?? ""} />
      ) : null}

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground">Nome</div>
        <Input
          name="name"
          placeholder="Ex: Louvor"
          required
          defaultValue={props.defaultValues?.name ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground">Descrição</div>
        <Input
          name="description"
          placeholder="Opcional"
          defaultValue={props.defaultValues?.description ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground">Líder do Ministério</div>
        <LeaderPicker
          members={props.members}
          defaultLeaderId={props.defaultValues?.leaderId ?? null}
        />
      </div>

      {isEdit ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            className="size-4"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Ministério ativo</span>
        </label>
      ) : null}

      {actionState.error ? (
        <div className="rounded-2xl border border-red-400/60 bg-red-500/10 p-3 text-xs font-medium text-red-400">
          {actionState.error}
        </div>
      ) : null}
      {actionState.ok && actionState.message ? (
        <div className="rounded-2xl border border-emerald-400/60 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-300">
          {actionState.message}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Salvando…" : props.submitLabel}
      </Button>
    </form>
  );
}
