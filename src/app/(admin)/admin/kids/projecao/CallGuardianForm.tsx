"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { sendProjectionMessage, type KidsProjectionFormState } from "./actions";
import { KIDS_PROJECTION_MESSAGE_MAX, KIDS_PROJECTION_PRESETS } from "@/lib/kids-projection";

const initialState: KidsProjectionFormState = { ok: false, message: "", error: "" };

type ChildOption = { id: string; fullName: string };

export function CallGuardianForm({ children }: { children: ChildOption[] }) {
  const [state, formAction, pending] = useActionState(sendProjectionMessage, initialState);
  const [preset, setPreset] = useState<string>(KIDS_PROJECTION_PRESETS[0]);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o formulário após envio bem-sucedido para facilitar chamadas seguidas.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPreset(KIDS_PROJECTION_PRESETS[0]);
    }
  }, [state.ok, state.message]);

  const isCustom = preset === "__custom__";

  return (
    <form ref={formRef} action={formAction} className="rounded-3xl border border-border bg-card p-5">
      <div className="text-sm font-medium">Chamar Responsável</div>
      <p className="mt-1 text-xs text-muted-foreground">
        A mensagem aparece imediatamente na tela da projeção com alerta piscando
        até o operador marcar como visualizada. Somente o necessário é exibido —
        nunca envie dados médicos ou sensíveis.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Criança</span>
          <select
            name="childId"
            required
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#58a7ff]/60"
            defaultValue=""
          >
            <option value="" disabled>
              Selecione a criança…
            </option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Listadas apenas crianças com check-in ativo neste culto (ou de hoje).
          </span>
        </label>

        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground">Mensagem</legend>
          <div className="mt-2 space-y-2">
            {KIDS_PROJECTION_PRESETS.map((option) => (
              <label key={option} className="flex items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="preset"
                  value={option}
                  checked={preset === option}
                  onChange={() => setPreset(option)}
                  className="h-4 w-4 accent-[#58a7ff]"
                />
                {option}
              </label>
            ))}
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="preset"
                value="__custom__"
                checked={isCustom}
                onChange={() => setPreset("__custom__")}
                className="h-4 w-4 accent-[#58a7ff]"
              />
              Outra mensagem
            </label>
          </div>
        </fieldset>

        {isCustom ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Mensagem personalizada
            </span>
            <textarea
              name="customMessage"
              rows={2}
              maxLength={KIDS_PROJECTION_MESSAGE_MAX}
              placeholder="Ex.: Responsável da Maria, favor comparecer ao Kids."
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#58a7ff]/60"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Máximo de {KIDS_PROJECTION_MESSAGE_MAX} caracteres.
            </span>
          </label>
        ) : null}
      </div>

      {state.error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {state.error}
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {state.message}
        </div>
      ) : null}

      <div className="mt-4">
        <Button type="submit" disabled={pending || children.length === 0}>
          {pending ? "Enviando…" : "Enviar para projeção"}
        </Button>
      </div>
    </form>
  );
}
