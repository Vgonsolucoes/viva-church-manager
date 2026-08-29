"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { RefreshCw, Youtube, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { getYoutubeWatchUrl } from "@/server/youtube";

export type YoutubeVideoRow = {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: string | null;
  viewCount: number | null;
  visibleOnSite: boolean;
  syncStatus: "PENDING" | "SYNCED" | "ERROR";
  syncError: string | null;
};

export function YoutubeVideosClient(props: {
  videos: YoutubeVideoRow[];
  canWrite: boolean;
  channelHandle: string;
  hasApiKey: boolean;
  channelIdSet: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const [localVideos, setLocalVideos] = useState<YoutubeVideoRow[]>(props.videos);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let list = localVideos;
    if (filter === "visible") list = list.filter((v) => v.visibleOnSite);
    if (filter === "hidden") list = list.filter((v) => !v.visibleOnSite);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.description ?? "").toLowerCase().includes(q) ||
          v.youtubeId.toLowerCase().includes(q),
      );
    }
    return [...list].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }, [localVideos, query, filter]);

  const visibleCount = localVideos.filter((v) => v.visibleOnSite).length;

  async function handleSync() {
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const res = await fetch("/api/admin/youtube-videos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        imported?: number;
        updated?: number;
        total?: number;
        error?: string;
        items?: YoutubeVideoRow[];
      };
      if (!res.ok || !data.ok) {
        setLastSyncResult(data.error ?? "Falha ao sincronizar.");
      } else {
        setLastSyncResult(
          `Sincronizado: ${data.imported ?? 0} novos, ${data.updated ?? 0} atualizados. Total: ${data.total ?? 0}`,
        );
        if (Array.isArray(data.items)) setLocalVideos(data.items);
      }
    } catch {
      setLastSyncResult("Falha na comunicacao com o servidor.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(id: string, currentVisible: boolean) {
    if (!props.canWrite) return;
    setToggling((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/admin/youtube-videos/${id}/toggle-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleOnSite: !currentVisible }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        visibleOnSite?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setLocalVideos((list) =>
          list.map((v) =>
            v.id === id ? { ...v, visibleOnSite: Boolean(data.visibleOnSite) } : v,
          ),
        );
      }
    } finally {
      setToggling((s) => ({ ...s, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Vídeos do YouTube</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Canal: <span className="font-medium text-foreground">{props.channelHandle}</span>
          </div>
          {!props.hasApiKey && (
            <div className="mt-2 text-xs text-amber-400">
              Dica: defina YOUTUBE_API_KEY para obter informacoes completas (duracao, views etc.).
              Usando RSS como fallback.
            </div>
          )}
          {!props.channelIdSet && (
            <div className="mt-1 text-xs text-rose-400">
              Alerta: YOUTUBE_CHANNEL_ID nao configurado e nao foi possivel resolver pelo
              handle. Configure uma das variaveis.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-muted/10">{localVideos.length} sincronizados</Badge>
          <Badge className="border-[rgba(88,167,255,0.22)] bg-[rgba(88,167,255,0.10)] text-foreground">
            {visibleCount} visiveis no site
          </Badge>
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing || !props.canWrite}
          >
            <RefreshCw className={cn("mr-2 size-4", syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar canal"}
          </Button>
        </div>
      </div>

      {lastSyncResult ? (
        <div className="rounded-2xl border border-border/80 bg-muted/10 px-4 py-3 text-sm text-foreground">
          {lastSyncResult}
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por titulo, descricao ou ID do video..."
              className="h-11 pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {(["all", "visible", "hidden"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "h-9 rounded-2xl border border-border/80 px-3 text-xs font-semibold transition",
                  filter === f
                    ? "bg-[rgba(88,167,255,0.16)] text-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground",
                )}
              >
                {f === "all" ? "Todos" : f === "visible" ? "Visiveis" : "Ocultos"}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-3">
          {filtered.length ? (
            filtered.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-muted/10 p-3 sm:flex-row sm:items-center"
              >
                <div className="shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-black sm:w-48 sm:h-28">
                  {v.thumbnailUrl ? (
                    <Image
                      src={v.thumbnailUrl}
                      alt={v.title}
                      width={320}
                      height={180}
                      className="aspect-video h-full w-full object-cover"
                      loading="lazy"
                      unoptimized
                      loader={({ src }) => src}
                    />
                  ) : (
                    <div className="flex aspect-video h-full w-full items-center justify-center text-muted-foreground">
                      <Youtube className="size-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {v.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {v.description?.trim() || "Sem descricao."}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge className="bg-muted/10">{v.youtubeId}</Badge>
                    <span>
                      Publicado:{" "}
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                        new Date(v.publishedAt),
                      )}
                    </span>
                    {v.viewCount ? <Badge className="bg-muted/10">{v.viewCount.toLocaleString("pt-BR")} views</Badge> : null}
                    {v.syncStatus === "ERROR" ? (
                      <Badge className="border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.10)] text-foreground">
                        Erro sync
                      </Badge>
                    ) : null}
                    <a
                      href={getYoutubeWatchUrl(v.youtubeId)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Youtube className="size-3.5" /> Abrir no YouTube
                    </a>
                  </div>
                </div>
                <div className="shrink-0 sm:w-40">
                  <Button
                    variant={v.visibleOnSite ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    disabled={!props.canWrite || toggling[v.id]}
                    onClick={() => handleToggle(v.id, v.visibleOnSite)}
                  >
                    {v.visibleOnSite ? (
                      <>
                        <Eye className="mr-2 size-4" /> Visivel
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-2 size-4" /> Oculto
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border/80 bg-muted/5 px-6 py-10 text-center">
              <Youtube className="size-10 text-muted-foreground" />
              <div className="text-sm font-semibold">Nenhum video encontrado</div>
              <div className="text-xs text-muted-foreground">
                Clique em <span className="font-semibold">Sincronizar canal</span> para importar os
                videos do canal {props.channelHandle}.
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
