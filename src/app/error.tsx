"use client";

import { useEffect } from "react";

export default function RootErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error] Error boundary raiz acionado:", props.error, "digest=", props.error?.digest);
  }, [props.error]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-lg font-semibold">Página indisponível no momento</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Um erro inesperado aconteceu ao tentar carregar esta página. Use os botões abaixo
            para tentar novamente ou retornar a uma rota segura.
          </div>
          {typeof props.error?.digest === "string" && props.error.digest.length > 0 ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Identificador do erro (digest)
              </div>
              <div className="mt-1 font-mono text-xs break-all">{props.error.digest}</div>
            </div>
          ) : null}
          {process.env.NODE_ENV === "development" && typeof props.error?.message === "string" ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Mensagem (development)
              </div>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs break-all">
                {props.error.message}
              </pre>
            </div>
          ) : null}
          {process.env.NODE_ENV === "development" && typeof props.error?.stack === "string" ? (
            <details className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <summary className="text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer">
                Stack trace (development)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] break-all">
                {props.error.stack}
              </pre>
            </details>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.href = "/admin";
              }}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Ir para Painel Admin
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
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted/40"
            >
              Voltar ao início
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted/40"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
