"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const END_REASONS = [
  "Discipulado concluído",
  "Discípulo indisponível",
  "Discipulador indisponível",
  "Mudança de cidade / igreja",
  "A pedido do discípulo",
  "Ajuste pastoral",
  "Outro motivo",
] as const;

export function EndDiscipleshipDialog({
  discipleshipId,
  disciplerName,
  discipleName,
  action,
}: {
  discipleshipId: string;
  disciplerName: string;
  discipleName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 size-4" />
        Excluir Vínculo
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão de vínculo"
          onClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Excluir vínculo de discipulado</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {disciplerName} <span className="text-muted-foreground">→</span> {discipleName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-xl border border-border/70 p-2 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
              O vínculo será <span className="font-semibold text-foreground">encerrado</span> e não
              apagado. Todo o histórico, encontros e registros de auditoria serão preservados.
            </div>

            <form
              action={async (formData) => {
                setSubmitting(true);
                try {
                  await action(formData);
                  setOpen(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="id" value={discipleshipId} />

              <div className="space-y-2">
                <label htmlFor="end-reason" className="text-xs font-medium text-muted-foreground">
                  Motivo do encerramento *
                </label>
                <select
                  id="end-reason"
                  name="reason"
                  required
                  defaultValue=""
                  className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecionar motivo
                  </option>
                  {END_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="end-note" className="text-xs font-medium text-muted-foreground">
                  Observação (opcional)
                </label>
                <textarea
                  id="end-note"
                  name="note"
                  className="min-h-24 w-full rounded-2xl border border-border/80 bg-background px-3 py-3 text-sm"
                  placeholder="Contexto adicional sobre o encerramento"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Encerrando..." : "Confirmar encerramento"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
