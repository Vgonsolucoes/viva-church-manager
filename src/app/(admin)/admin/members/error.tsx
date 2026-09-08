"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function MembersErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[members] Error boundary acionado:", props.error);
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
          {props.error?.digest ? (
            <div className="mt-2 text-[11px] font-mono text-muted-foreground/80">
              Identificador do erro: <span className="ml-1">{props.error.digest}</span>
            </div>
          ) : null}
        </div>
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
