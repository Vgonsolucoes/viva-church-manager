"use client";

import { useEffect, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { setPublicRegistrationEnabled } from "./actions";

export function CadastroPublicoClient(props: {
  enabled: boolean;
  publicPath: string;
  configuredBaseUrl: string | null;
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Prioridade: NEXT_PUBLIC_APP_URL configurada. Sem ela, usa a origem atual
  // do navegador (em produção é o domínio público) — nunca localhost fixo.
  const [baseUrl, setBaseUrl] = useState(props.configuredBaseUrl ?? "");
  useEffect(() => {
    if (!props.configuredBaseUrl) {
      setBaseUrl(window.location.origin);
    }
  }, [props.configuredBaseUrl]);

  const publicUrl = `${baseUrl}${props.publicPath}`;

  function copyLink() {
    setCopied(false);
    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {
        // Fallback para navegadores sem clipboard API (ex: http sem https)
        const input = document.createElement("input");
        input.value = publicUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
      });
  }

  function shareWhatsApp() {
    const text = `Olá! 👋\nFaça seu cadastro na Viva Church através do link abaixo:\n\n${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function toggle(next: boolean) {
    setError(null);
    setMessage(null);
    const previous = enabled;
    setEnabled(next); // otimista
    startTransition(async () => {
      const result = await setPublicRegistrationEnabled(next);
      if (!result.ok) {
        setEnabled(previous); // reverte
        setError(result.error ?? "Falha ao salvar a configuração.");
        return;
      }
      setMessage(result.message ?? null);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block size-2.5 rounded-full ${enabled ? "bg-emerald-400" : "bg-rose-400"}`}
          />
          <span className="font-medium">
            {enabled ? "Cadastro público ATIVO" : "Cadastro público DESATIVADO"}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending || !props.canManage}
          onClick={() => toggle(!enabled)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 ${
            enabled ? "border-emerald-400/50 bg-emerald-500/30" : "border-border bg-muted/30"
          }`}
        >
          <span
            className={`inline-block size-6 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
          <span className="sr-only">{enabled ? "Desativar cadastro" : "Ativar cadastro"}</span>
        </button>
      </div>

      {!props.canManage ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          Somente um Super Administrador pode ativar ou desativar o cadastro público.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Link para cadastro
        </div>
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 font-mono text-sm break-all">
          {publicUrl}
        </div>
        {!props.configuredBaseUrl ? (
          <div className="text-xs text-muted-foreground">
            Usando o endereço atual do navegador. Para fixar o domínio oficial, configure a variável
            <span className="font-mono"> NEXT_PUBLIC_APP_URL </span>
            no EasyPanel (ex: https://seu-dominio.com.br).
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" size="sm" onClick={copyLink}>
          📋 {copied ? "Link copiado com sucesso!" : "Copiar link"}
        </Button>
        <a
          href={props.publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-2xl border border-border/80 bg-muted/20 px-4 text-sm font-semibold tracking-tight text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-muted/30"
        >
          ↗ Abrir página
        </a>
        <Button type="button" variant="secondary" size="sm" onClick={shareWhatsApp}>
          💬 Compartilhar pelo WhatsApp
        </Button>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          ⚠️ Este link está temporariamente desativado para novos cadastros. Ative o cadastro para
          que o mesmo endereço volte a funcionar.
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-white p-5">
        <QRCodeSVG value={publicUrl} size={180} includeMargin={false} level="M" />
        <div className="text-xs text-muted-foreground">Escaneie para abrir o cadastro.</div>
      </div>
    </div>
  );
}
