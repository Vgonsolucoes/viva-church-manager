"use client";

import { useEffect } from "react";

export default function GlobalErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error] Error boundary global acionado:", props.error, "digest=", props.error?.digest);
  }, [props.error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen bg-background text-foreground">
          <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-12">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="text-lg font-semibold">Ocorreu um problema inesperado</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Um erro genérico foi lançado e não foi possível renderizar a página solicitada.
                Por favor, tente recarregar ou retorne ao início.
              </div>
              {typeof props.error?.digest === "string" && props.error.digest.length > 0 ? (
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Identificador do erro (digest)
                  </div>
                  <div className="mt-1 font-mono text-xs break-all">{props.error.digest}</div>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") window.location.href = "/";
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Voltar ao início
                </button>
                <button
                  type="button"
                  onClick={() => props.reset()}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted/40"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") window.location.reload();
                  }}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted/40"
                >
                  Recarregar a página
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
