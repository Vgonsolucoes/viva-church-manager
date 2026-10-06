"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function MembersErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[members] Error boundary acionado:",
      props.error,
      "digest=",
      props.error?.digest,
      "message=",
      props.error?.message,
    );
  }, [props.error]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Membros</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Cadastro, histórico e acompanhamento.
        </div>
      </div>
      <Card className="p-6">
        <div className="text-sm font-semibold text-red-600 dark:text-red-400">
          Ocorreu um problema ao carregar o módulo de membros.
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Se o problema continuar, tente recarregar a página ou limpar o cache do
          navegador. Clique em Tentar novamente abaixo para re-renderizar.
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

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              window.location.href = "/admin/members";
            }}
            variant="primary"
            size="sm"
          >
            Recarregar página
          </Button>
          <Button type="button" onClick={props.reset} variant="outline" size="sm">
            Tentar novamente
          </Button>
          <a
            href="/admin"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-border/80 bg-transparent px-4 text-xs font-medium text-foreground hover:bg-muted/20"
          >
            Voltar para Dashboard
          </a>
        </div>
      </Card>
    </div>
  );
}
