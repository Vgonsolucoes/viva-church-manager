"use client";

import { useActionState, useRef, useTransition, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createKidsService,
  deleteKidsService,
  toggleKidsServiceActive,
  type KidsServiceFormState,
} from "./actions";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export type SerializedKidsService = {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  isActive: boolean;
};

const initialState: KidsServiceFormState = { ok: false, message: "", error: "" };

export function KidsServiceManager(props: {
  services: SerializedKidsService[];
  activeServiceId: string | null;
  canWrite: boolean;
}) {
  const [state, formAction, pending] = useActionState(createKidsService, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [rowPending, startRowTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function runRowAction(
    action: (prev: KidsServiceFormState, formData: FormData) => Promise<KidsServiceFormState>,
    data: Record<string, string>,
  ) {
    setFeedback(null);
    startRowTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(data)) fd.set(k, v);
      const result = await action(initialState, fd);
      if (result.ok) {
        setFeedback({ type: "success", text: result.message });
      } else if (result.error) {
        setFeedback({ type: "error", text: result.error });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Cultos cadastrados</div>
            <div className="text-xs text-muted-foreground">{props.services.length} horários</div>
          </div>

          {feedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {props.services.length ? (
              props.services.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      {props.activeServiceId === s.id ? (
                        <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-100">
                          Culto ativo agora
                        </Badge>
                      ) : null}
                      {!s.isActive ? <Badge>Inativo</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {WEEKDAYS[s.dayOfWeek]} • {s.startTime} → {s.endTime}
                      {s.toleranceMinutes > 0
                        ? ` • tolerância de ${s.toleranceMinutes} min`
                        : ""}
                    </div>
                  </div>
                  {props.canWrite ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={rowPending}
                        onClick={() =>
                          runRowAction(toggleKidsServiceActive, {
                            serviceId: s.id,
                            nextActive: s.isActive ? "false" : "true",
                          })
                        }
                      >
                        {s.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={rowPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remover o culto "${s.name}"? Os check-ins já realizados serão preservados.`,
                            )
                          ) {
                            runRowAction(deleteKidsService, { serviceId: s.id });
                          }
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhum horário de culto cadastrado. Cadastre o primeiro ao lado.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="text-sm font-medium">Cadastrar horário de culto</div>
        {!props.canWrite ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Somente usuários com permissão de escrita no Ministério Infantil podem gerenciar os
            horários.
          </div>
        ) : (
          <form ref={formRef} action={formAction} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Nome do culto</div>
              <Input name="name" required placeholder="Ex: Culto da Família" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Dia da semana</div>
              <select
                name="dayOfWeek"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                required
                defaultValue="0"
              >
                {WEEKDAYS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Início</div>
                <Input name="startTime" type="time" required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Término previsto</div>
                <Input name="endTime" type="time" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Tolerância (minutos)
              </div>
              <Input name="toleranceMinutes" type="number" min={0} max={180} defaultValue={30} />
              <div className="text-xs text-muted-foreground">
                Permite check-in alguns minutos antes do início e após o término do culto.
              </div>
            </div>

            {state.error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {state.error}
              </div>
            ) : null}
            {state.ok && state.message ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {state.message}
              </div>
            ) : null}

            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Cadastrar culto"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
