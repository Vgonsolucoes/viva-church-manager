"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { saveKidsPrintConfig, type KidsPrintConfigFormState } from "./actions";
import type { KidsPrintConfig } from "@/server/kids-print";

const initialState: KidsPrintConfigFormState = { ok: false, message: "", error: "" };

export function KidsPrintConfigForm({ config }: { config: KidsPrintConfig }) {
  const [state, formAction, pending] = useActionState(saveKidsPrintConfig, initialState);

  return (
    <form action={formAction} className="rounded-3xl border border-border bg-card p-5">
      <div className="text-sm font-medium">Configuração de impressão</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ajustes aplicados às próximas etiquetas geradas. Sem necessidade de
        redeploy.
      </p>

      <div className="mt-4 space-y-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={config.enabled}
            className="mt-0.5 h-4 w-4 rounded border-border accent-[#58a7ff]"
          />
          <span>
            <span className="block text-sm font-medium">Impressão automática</span>
            <span className="block text-xs text-muted-foreground">
              Quando ativa, todo check-in confirmado gera as duas etiquetas na
              fila. Quando desativada, os check-ins continuam normalmente, sem
              gerar etiquetas.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Largura da etiqueta (mm)
            </span>
            <input
              type="number"
              name="labelWidthMm"
              min={30}
              max={120}
              step={1}
              defaultValue={config.labelWidthMm}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#58a7ff]/60"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Ex.: 62 para bobinas Brother QL de 62mm.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Cópias por etiqueta
            </span>
            <input
              type="number"
              name="copies"
              min={1}
              max={4}
              step={1}
              defaultValue={config.copies}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#58a7ff]/60"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Quantidade de vias de cada etiqueta (criança e responsável).
            </span>
          </label>
        </div>
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
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}
