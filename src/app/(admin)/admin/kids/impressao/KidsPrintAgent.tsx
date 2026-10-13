"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type LabelPayload = {
  labelType: "CHILD" | "GUARDIAN";
  childName: string;
  guardianName: string | null;
  pickupCode: string;
  serviceName: string | null;
  checkInAt: string;
};

type PendingJob = {
  id: string;
  labelType: "CHILD" | "GUARDIAN";
  copies: number;
  payload: LabelPayload;
  createdAt: string;
};

type PendingResponse = {
  config: { labelWidthMm: number; labelHeightMm: number; enabled: boolean };
  jobs: PendingJob[];
};

const STORAGE_KEY = "viva-kids-print-agent-active";
const POLL_MS = 4000;

type AgentStatus = "idle" | "printing" | "finishing";

/**
 * Agente local de impressão (seção 11 da spec): esta página, aberta no
 * computador da recepção com a impressora instalada, faz polling na fila
 * KidsPrintJob e imprime as etiquetas via window.print() (CSS de etiqueta).
 * O EasyPanel nunca acessa a impressora diretamente.
 */
export function KidsPrintAgent() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [labelWidthMm, setLabelWidthMm] = useState(80);
  const [labelHeightMm, setLabelHeightMm] = useState(50);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);
  const printingRef = useRef(false);
  // O portal da área de impressão só pode ser criado após montar (SSR não tem document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Restaura a escolha do operador: o agente continua ativo após F5.
  useEffect(() => {
    try {
      setActive(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage indisponível — agente começa desativado.
    }
  }, []);

  const toggleActive = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // sem persistência — mantém apenas em memória
      }
      return next;
    });
  }, []);

  const finishJobs = useCallback(
    async (outcome: "printed" | "failed", error?: string) => {
      if (!printingRef.current) return;
      setStatus("finishing");
      const current = jobs;
      await Promise.all(
        // Jobs "test-*" são do botão Testar Impressão Kids — não existem na fila.
        current
          .filter((job) => !job.id.startsWith("test-"))
          .map((job) =>
            fetch(`/api/v1/kids/print-jobs/${job.id}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ outcome, error }),
            }).catch(() => null),
          ),
      );
      printingRef.current = false;
      setJobs([]);
      setStatus("idle");
      router.refresh();
    },
    [jobs, router],
  );

  /** Imprime 1 etiqueta da criança + 1 do responsável (mesmo código), sem gravar na fila. */
  const runTestPrint = useCallback(() => {
    if (printingRef.current) return;
    const now = new Date().toISOString();
    const basePayload: Omit<LabelPayload, "labelType"> = {
      childName: "Criança Exemplo",
      guardianName: "Responsável Exemplo",
      pickupCode: "0000",
      serviceName: "Teste de impressão",
      checkInAt: now,
    };
    printingRef.current = true;
    setJobs([
      {
        id: "test-child",
        labelType: "CHILD",
        copies: 1,
        payload: { ...basePayload, labelType: "CHILD" },
        createdAt: now,
      },
      {
        id: "test-guardian",
        labelType: "GUARDIAN",
        copies: 1,
        payload: { ...basePayload, labelType: "GUARDIAN" },
        createdAt: now,
      },
    ]);
    setStatus("printing");
  }, []);

  // Confirmação automática após o diálogo de impressão fechar (imprimir ou
  // cancelar — no cancelamento o operador pode reenviar pela lista abaixo).
  useEffect(() => {
    if (status !== "printing") return;
    const onAfterPrint = () => void finishJobs("printed");
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [status, finishJobs]);

  // Dispara a impressão após as etiquetas renderizarem na área de print.
  useEffect(() => {
    if (status !== "printing" || jobs.length === 0) return;
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch {
        void finishJobs("failed", "Não foi possível abrir o diálogo de impressão.");
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, jobs.length]);

  // Polling da fila enquanto o agente está ativo e ocioso.
  useEffect(() => {
    if (!active || status !== "idle") return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/v1/kids/print-jobs?take=10", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PendingResponse;
        if (cancelled) return;
        setLastPollAt(new Date());
        setLastError(null);
        setLabelWidthMm(data.config.labelWidthMm);
        setLabelHeightMm(data.config.labelHeightMm);
        if (data.jobs.length > 0) {
          printingRef.current = true;
          setJobs(data.jobs);
          setStatus("printing");
        }
      } catch (err) {
        if (cancelled) return;
        setLastError(
          err instanceof Error ? err.message : "Falha ao consultar a fila.",
        );
      }
    };

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, status]);

  const totalLabels = jobs.reduce((sum, job) => sum + Math.max(1, job.copies), 0);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Agente de impressão local</div>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Deixe esta página aberta no computador da recepção (com a impressora
            de etiquetas instalada como padrão). A cada check-in confirmado, as
            duas etiquetas são impressas automaticamente.
          </p>
        </div>
        <Button
          type="button"
          variant={active ? "secondary" : "primary"}
          onClick={toggleActive}
          disabled={status === "printing" || status === "finishing"}
        >
          {active ? "Desativar agente" : "Ativar agente neste computador"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={
            active
              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-medium text-emerald-100"
              : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/20 px-3 py-1 font-medium text-muted-foreground"
          }
        >
          <span
            className={
              active
                ? "h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                : "h-2 w-2 rounded-full bg-muted-foreground/50"
            }
          />
          {active ? "Agente ativo — monitorando a fila" : "Agente desativado"}
        </span>
        {active && lastPollAt ? (
          <span className="text-muted-foreground">
            Última verificação às{" "}
            {lastPollAt.toLocaleTimeString("pt-BR", { hour12: false })}
          </span>
        ) : null}
        {lastError ? (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-red-200">
            Erro na fila: {lastError}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={runTestPrint}
          disabled={status !== "idle"}
        >
          Testar Impressão Kids
        </Button>
        <span className="text-xs text-muted-foreground">
          Imprime 1 etiqueta da criança + 1 do responsável com código de exemplo
          (não grava na fila).
        </span>
      </div>

      {status === "printing" || status === "finishing" ? (
        <div className="mt-4 rounded-2xl border border-[#58a7ff]/40 bg-[#58a7ff]/10 p-4">
          <div className="text-sm font-semibold">
            Imprimindo {totalLabels}{" "}
            {totalLabels === 1 ? "etiqueta" : "etiquetas"}…
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Se o diálogo de impressão não abrir ou a impressora falhar, use os
            botões abaixo. Etiquetas não confirmadas podem ser reenviadas na
            lista de etiquetas recentes.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={status === "finishing"}
              onClick={() => void finishJobs("printed")}
            >
              Confirmar impressão
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={status === "finishing"}
              onClick={() =>
                void finishJobs("failed", "Operador marcou falha na impressão.")
              }
            >
              Marcar falha
            </Button>
          </div>
        </div>
      ) : null}

      {/* Área exclusiva de impressão (Epson TM-T20X, bobina térmica de 80 mm).
          Renderizada em portal DIRETO no <body>: no @media print, todos os demais
          filhos do body recebem display:none, o que REMOVE o restante da página
          admin do fluxo de impressão. (A abordagem anterior com visibility:hidden
          mantinha o layout da página ocupando altura — origem das partes em branco.)
          Cada etiqueta é uma página lógica de largura × altura exatos (padrão
          80 × 50 mm): a quebra de página faz a TM-T20X avançar e cortar cada
          etiqueta (corte configurado no driver Epson — "cut at end of page").
          A última etiqueta não força quebra, evitando papel em branco no final.
          O navegador não envia comandos ESC/POS; o corte físico é responsabilidade
          do driver/equipamento. */}
      {mounted
        ? createPortal(
            <>
              <style>{`
                @media screen {
                  .kids-print-area { display: none !important; }
                }
                @media print {
                  @page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0; }
                  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
                  body > *:not(.kids-print-area) { display: none !important; }
                  .kids-print-area {
                    display: block !important;
                    width: ${labelWidthMm}mm;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff;
                  }
                  .kids-label {
                    width: ${labelWidthMm}mm;
                    height: ${labelHeightMm}mm;
                    box-sizing: border-box;
                    padding: 2mm 3mm;
                    page-break-after: always;
                    break-after: page;
                    break-inside: avoid;
                    overflow: hidden;
                    text-align: center;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #000;
                  }
                  .kids-label:last-child {
                    page-break-after: auto;
                    break-after: auto;
                  }
                  .kids-label-header {
                    font-size: 3mm;
                    font-weight: 700;
                    letter-spacing: 0.4mm;
                    border-top: 0.5mm solid #000;
                    border-bottom: 0.5mm solid #000;
                    padding: 1mm 0;
                  }
                  .kids-label-child {
                    font-size: 5.5mm;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-top: 1.5mm;
                    text-transform: uppercase;
                    word-break: break-word;
                  }
                  .kids-label-child-sm {
                    font-size: 4.2mm;
                    font-weight: 700;
                    line-height: 1.15;
                    margin-top: 1.5mm;
                    word-break: break-word;
                  }
                  .kids-label-meta { font-size: 3mm; margin-top: 1.5mm; }
                  .kids-label-meta strong { font-size: 3.6mm; font-weight: 700; }
                  .kids-label-code-label { font-size: 3mm; margin-top: 1.5mm; }
                  .kids-label-code {
                    font-size: 7mm;
                    font-weight: 800;
                    letter-spacing: 1mm;
                    line-height: 1;
                  }
                }
              `}</style>
              <div className="kids-print-area" aria-hidden="true">
                {jobs.flatMap((job) =>
                  Array.from({ length: Math.max(1, job.copies) }, (_, copyIndex) => (
                    <div key={`${job.id}-${copyIndex}`} className="kids-label">
                      <div className="kids-label-header">
                        VIVA CHURCH KIDS{job.payload.labelType === "GUARDIAN" ? " — RESPONSÁVEL" : ""}
                      </div>
                      {job.payload.labelType === "CHILD" ? (
                        <>
                          <div className="kids-label-child">{job.payload.childName}</div>
                          <div className="kids-label-meta">
                            Responsável:
                            <br />
                            <strong>{job.payload.guardianName ?? "Não informado"}</strong>
                          </div>
                          <div className="kids-label-code-label">Código:</div>
                          <div className="kids-label-code">{job.payload.pickupCode}</div>
                        </>
                      ) : (
                        <>
                          <div className="kids-label-child-sm">{job.payload.childName}</div>
                          <div className="kids-label-code-label">Código:</div>
                          <div className="kids-label-code">{job.payload.pickupCode}</div>
                        </>
                      )}
                    </div>
                  )),
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
