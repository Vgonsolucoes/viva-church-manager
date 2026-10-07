"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateSchedule, type ScheduleFormState } from "./actions";

type MinistryOption = { id: string; name: string };

type Props = {
  schedule: {
    id: string;
    title: string;
    kind: string;
    startsAtLocal: string;
    ministryId: string | null;
    assignmentsCount: number;
  };
  ministries: MinistryOption[];
};

const initialState: ScheduleFormState = { ok: false, message: "", error: "" };

const kindOptions = [
  { value: "SERVICE", label: "Culto" },
  { value: "EVENT", label: "Evento" },
  { value: "CELL", label: "Célula" },
  { value: "MEETING", label: "Reunião" },
  { value: "REHEARSAL", label: "Ensaio" },
  { value: "OTHER", label: "Outro" },
] as const;

export function ScheduleEditModal(props: Props) {
  const [open, setOpen] = useState(false);
  const [ministryId, setMinistryId] = useState(props.schedule.ministryId ?? "");
  const [state, formAction, pending] = useActionState(
    updateSchedule,
    initialState,
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const ministryChanged = ministryId !== (props.schedule.ministryId ?? "");
  const showVolunteerWarning =
    props.schedule.assignmentsCount > 0 && ministryChanged;

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Editar
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Editar escala</div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="scheduleId" value={props.schedule.id} />

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Título
                </div>
                <Input
                  name="title"
                  defaultValue={props.schedule.title}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Tipo
                </div>
                <select
                  name="kind"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  defaultValue={props.schedule.kind}
                >
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Data e hora
                </div>
                <Input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={props.schedule.startsAtLocal}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Ministério
                </div>
                <select
                  name="ministryId"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={ministryId}
                  onChange={(event) => setMinistryId(event.target.value)}
                >
                  <option value="">Selecione um Ministério</option>
                  {props.ministries.map((ministry) => (
                    <option key={ministry.id} value={ministry.id}>
                      {ministry.name}
                    </option>
                  ))}
                </select>
              </div>

              {showVolunteerWarning ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Atenção: esta escala possui {props.schedule.assignmentsCount}{" "}
                  voluntário(s) alocado(s). Ao trocar o ministério, verifique se
                  os voluntários alocados pertencem ao novo ministério.
                </div>
              ) : null}

              {state.error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {state.error}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
