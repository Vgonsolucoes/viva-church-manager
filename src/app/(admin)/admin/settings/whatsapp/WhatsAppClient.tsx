"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  whatsappCreateAndGetQr,
  whatsappDeleteInstance,
  whatsappDisconnect,
  whatsappGetStatus,
  whatsappRefreshQr,
  type WhatsAppActionResult,
} from "./actions";

type ConnectionState = WhatsAppActionResult["state"];

function stateLabel(state: ConnectionState, exists: boolean): { text: string; badgeClass: string } {
  if (!exists) return { text: "Não conectado", badgeClass: "text-muted-foreground" };
  if (state === "open") return { text: "Conectado", badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  if (state === "connecting") return { text: "Conectando…", badgeClass: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200" };
  if (state === "close") return { text: "Desconectado", badgeClass: "border-red-500/40 bg-red-500/10 text-red-300" };
  return { text: "Desconhecido", badgeClass: "text-muted-foreground" };
}

function qrSrc(base64: string | null): string | null {
  if (!base64) return null;
  if (base64.startsWith("data:image/")) return base64;
  return `data:image/png;base64,${base64}`;
}

export function WhatsAppClient(props: {
  initialConfigured: boolean;
  initialExists: boolean;
  initialState: ConnectionState;
  initialError?: string | null;
}) {
  const [configured] = useState(props.initialConfigured);
  const [exists, setExists] = useState(props.initialExists);
  const [state, setState] = useState<ConnectionState>(props.initialState);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(props.initialError ?? null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apply = useCallback((result: WhatsAppActionResult) => {
    if (!result.ok) {
      setError(result.error ?? "Erro inesperado.");
      return;
    }
    setError(null);
    setExists(result.exists);
    setState(result.state);
    if (result.qrcodeBase64) setQrcode(result.qrcodeBase64);
    if (result.state === "open") setQrcode(null);
  }, []);

  const run = useCallback(
    (fn: () => Promise<WhatsAppActionResult>) => {
      startTransition(async () => {
        try {
          apply(await fn());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro inesperado.");
        }
      });
    },
    [apply],
  );

  // Polling de status enquanto não estiver conectado (para detectar leitura do QR).
  useEffect(() => {
    if (!configured) return;
    if (state === "open") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      void whatsappGetStatus()
        .then((result) => {
          if (result.ok) {
            setExists(result.exists);
            setState(result.state);
            if (result.state === "open") setQrcode(null);
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [configured, state]);

  const label = stateLabel(state, exists);
  const qr = qrSrc(qrcode);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium">Status da conexão</div>
        <Badge className={label.badgeClass}>{label.text}</Badge>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {!configured ? (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Configure as variáveis <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code> nas
          variáveis de ambiente do serviço (EasyPanel) e reimplante para habilitar esta integração.
        </div>
      ) : null}

      {configured && state !== "open" ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {exists
              ? "A instância existe, mas o WhatsApp não está conectado. Gere o QR Code e leia com o celular."
              : "Clique no botão abaixo para criar a instância automaticamente e gerar o QR Code de conexão."}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => run(whatsappCreateAndGetQr)}
            >
              {pending ? "Aguarde…" : exists ? "Gerar QR Code" : "Criar conexão e gerar QR Code"}
            </Button>
            {exists ? (
              <Button variant="outline" disabled={pending} onClick={() => run(whatsappRefreshQr)}>
                Atualizar QR Code
              </Button>
            ) : null}
          </div>

          {qr ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Leia o QR Code no WhatsApp (Aparelhos conectados)
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR Code de conexão WhatsApp"
                className="size-64 rounded-2xl border border-border bg-white object-contain p-2"
              />
              <div className="text-xs text-muted-foreground">
                No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho. O QR
                expira em alguns segundos — se expirar, clique em &quot;Atualizar QR Code&quot;.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {configured && exists && state === "open" ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          WhatsApp conectado com sucesso. A instância está pronta para enviar e receber mensagens.
        </div>
      ) : null}

      {configured && exists ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          {state === "open" ? (
            <Button variant="outline" disabled={pending} onClick={() => run(whatsappDisconnect)}>
              Desconectar
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Excluir a instância remove a conexão atual. Deseja continuar?")) {
                run(whatsappDeleteInstance);
              }
            }}
          >
            Excluir instância
          </Button>
        </div>
      ) : null}
    </div>
  );
}
