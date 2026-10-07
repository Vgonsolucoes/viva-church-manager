"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProjectionMessage = {
  id: string;
  childName: string;
  message: string;
  sentAt: string;
};

const POLL_MS = 4000;
const SOUND_REPEAT_MS = 20000;
const SOUND_STORAGE_KEY = "viva-kids-projection-sound";

function playAlertBeeps() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume().catch(() => undefined);
    // Três bipes curtos (880Hz) — som de alerta simples, sem arquivos externos.
    for (const offset of [0, 0.28, 0.56]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const start = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 2500);
  } catch {
    // Áudio bloqueado pelo navegador — o alerta visual continua funcionando.
  }
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Sao_Paulo",
});

export function KidsProjectionScreen({ operatorName }: { operatorName: string | null }) {
  const [messages, setMessages] = useState<ProjectionMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [ackBusyId, setAckBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const knownIdsRef = useRef<Set<string> | null>(null);
  const lastSoundAtRef = useRef(0);

  // Restaura preferência de som do operador.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
      if (stored !== null) setSoundOn(stored === "1");
    } catch {
      // sem persistência
    }
  }, []);

  // Alguns navegadores só liberam áudio após interação do usuário: o primeiro
  // toque na tela cria/retoma um AudioContext para desbloquear o alerta sonoro.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        void ctx
          .resume()
          .then(() => ctx.close())
          .catch(() => undefined);
      } catch {
        // áudio indisponível — o alerta visual continua funcionando
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Relógio do cabeçalho.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // sem persistência
      }
      return next;
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/kids/projection/messages?take=20", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages: ProjectionMessage[] };
      setConnected(true);
      setMessages(data.messages);

      // Som: toca ao surgir mensagem nova e repete a cada 20s enquanto houver
      // alerta não visualizado (seção 19 — até o operador marcar VISUALIZADO).
      const currentIds = new Set(data.messages.map((m) => m.id));
      const hasNew =
        knownIdsRef.current === null
          ? data.messages.length > 0
          : data.messages.some((m) => !knownIdsRef.current!.has(m.id));
      knownIdsRef.current = currentIds;

      if (data.messages.length > 0 && soundOn) {
        const sinceLast = Date.now() - lastSoundAtRef.current;
        if (hasNew || sinceLast >= SOUND_REPEAT_MS) {
          lastSoundAtRef.current = Date.now();
          playAlertBeeps();
        }
      }
    } catch {
      setConnected(false);
    }
  }, [soundOn]);

  useEffect(() => {
    void fetchMessages();
    const id = setInterval(() => void fetchMessages(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchMessages]);

  const markViewed = useCallback(async (id: string) => {
    setAckBusyId(id);
    try {
      await fetch(`/api/v1/kids/projection/messages/${id}/view`, { method: "POST" });
    } catch {
      // a próxima atualização do polling reexibe a mensagem se falhar
    } finally {
      setAckBusyId(null);
      void fetchMessages();
    }
  }, [fetchMessages]);

  const current = messages[0] ?? null;
  const queue = messages.slice(1);
  const alerting = current !== null;

  return (
    <main className="relative flex min-h-screen flex-col bg-black text-white">
      <style>{`
        @keyframes kidsAlertPulse {
          0%, 100% { background-color: rgba(239, 68, 68, 0.16); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
          50% { background-color: rgba(239, 68, 68, 0.38); box-shadow: 0 0 70px 12px rgba(239, 68, 68, 0.45); }
        }
        .kids-alert-pulse { animation: kidsAlertPulse 1s ease-in-out infinite; }
        @keyframes kidsAlertDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .kids-alert-dot { animation: kidsAlertDot 0.8s ease-in-out infinite; }
      `}</style>

      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <div className="text-lg font-bold tracking-wide">VIVA CHURCH</div>
          <div className="text-xs font-medium uppercase tracking-[0.3em] text-white/60">
            Comunicação Kids
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={
              connected
                ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                : "inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-300"
            }
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            />
            {connected ? "CONECTADO" : "SEM CONEXÃO"}
          </span>
          <span className="font-mono text-lg tabular-nums text-white/80">
            {timeFmt.format(now)}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
            title={soundOn ? "Desativar som de alerta" : "Ativar som de alerta"}
          >
            {soundOn ? "Som: ON" : "Som: OFF"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {alerting ? (
          <>
            <div className="kids-alert-pulse w-full max-w-3xl rounded-3xl border-2 border-red-500/70 p-10 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="kids-alert-dot inline-block h-4 w-4 rounded-full bg-red-500" />
                <span className="text-xl font-bold uppercase tracking-[0.2em] text-red-300">
                  Nova mensagem Kids
                </span>
                <span className="kids-alert-dot inline-block h-4 w-4 rounded-full bg-red-500" />
              </div>

              <div className="mt-8 text-6xl font-black uppercase leading-tight tracking-tight">
                {current.childName}
              </div>

              <div className="mt-6 text-3xl font-semibold text-white/90">
                {current.message}
              </div>

              <div className="mt-6 text-sm text-white/60">
                Recebido às {timeFmt.format(new Date(current.sentAt))}
              </div>

              <button
                type="button"
                disabled={ackBusyId === current.id}
                onClick={() => void markViewed(current.id)}
                className="mt-10 rounded-2xl bg-white px-10 py-4 text-xl font-bold text-black transition hover:bg-white/85 disabled:opacity-50"
              >
                {ackBusyId === current.id ? "Confirmando…" : "VISUALIZADO"}
              </button>
            </div>

            {queue.length > 0 ? (
              <div className="w-full max-w-3xl space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/50">
                  Na fila ({queue.length})
                </div>
                {queue.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <span className="font-bold uppercase">{m.childName}</span>
                      <span className="text-white/70"> — {m.message}</span>
                      <span className="ml-2 text-xs text-white/40">
                        {timeFmt.format(new Date(m.sentAt))}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={ackBusyId === m.id}
                      onClick={() => void markViewed(m.id)}
                      className="shrink-0 rounded-xl border border-white/25 px-4 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50"
                    >
                      Visualizado
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
              Aguardando mensagens
            </div>
            <div className="mt-4 text-2xl font-semibold text-white/70">
              Nenhuma solicitação do Kids no momento
            </div>
            <div className="mt-3 text-sm text-white/40">
              Esta tela pisca e emite alerta sonoro quando uma nova mensagem chegar.
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 px-6 py-3 text-center text-xs text-white/35">
        Operador{operatorName ? `: ${operatorName}` : ""} • Atualização automática a cada{" "}
        {POLL_MS / 1000}s
      </footer>
    </main>
  );
}
