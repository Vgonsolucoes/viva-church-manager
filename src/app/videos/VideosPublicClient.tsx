"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Play, X, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { YoutubeLogo } from "@/components/brand/YoutubeLogo";
import { getYoutubeEmbedUrl, getYoutubeWatchUrl } from "@/server/youtube";

export type PublicYoutubeVideo = {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: string | null;
  viewCount: number | null;
};

export function VideosPublicClient(props: {
  videos: PublicYoutubeVideo[];
  channelHandle?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? props.videos.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            (v.description ?? "").toLowerCase().includes(q),
        )
      : props.videos;
    return [...list].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }, [props.videos, query]);

  const active = filtered.find((v) => v.id === activeId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-14">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-border/80 bg-[rgba(11,23,48,0.6)] backdrop-blur">
                <YoutubeLogo className="size-5 text-rose-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">
                  Cultos e Mensagens
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Assista os ultimos videos do canal oficial
                  {props.channelHandle ? ` • ${props.channelHandle}` : ""}
                </div>
              </div>
            </div>
          </div>
          <div className="relative max-w-md flex-1 md:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mensagens e cultos..."
              className="h-11 pl-10"
            />
          </div>
        </header>

        {active ? (
          <section className="mt-8">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">
                    {active.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Publicado em{" "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
                      new Date(active.publishedAt),
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={getYoutubeWatchUrl(active.youtubeId)}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden text-xs font-semibold text-primary hover:underline sm:inline-flex"
                  >
                    Abrir no YouTube
                  </a>
                  <Button variant="outline" size="sm" onClick={() => setActiveId(null)}>
                    <X className="mr-2 size-4" /> Fechar
                  </Button>
                </div>
              </div>
              <div className="aspect-video w-full border-t border-border/80 bg-black">
                <iframe
                  src={getYoutubeEmbedUrl(active.youtubeId) + "?autoplay=1&rel=0"}
                  title={active.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              {active.description ? (
                <div className="px-6 py-5 text-sm text-muted-foreground whitespace-pre-wrap">
                  {active.description}
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        <section className="mt-8">
          {filtered.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveId(v.id)}
                  className={cn(
                    "group text-left overflow-hidden rounded-3xl border border-border/80 bg-[rgba(11,23,48,0.55)] backdrop-blur transition hover:bg-[rgba(11,23,48,0.8)] hover:shadow-[0_18px_70px_-48px_rgba(88,167,255,0.7)]",
                    activeId === v.id && "ring-2 ring-primary/40",
                  )}
                >
                  <div className="relative aspect-video overflow-hidden bg-black">
                    {v.thumbnailUrl ? (
                      <Image
                        src={v.thumbnailUrl}
                        alt={v.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                        unoptimized
                        loader={({ src }) => src}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <YoutubeLogo className="size-10" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                      <div className="flex size-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
                        <Play className="size-6 translate-x-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Badge className="border-border/80 bg-black/70 text-xs text-foreground backdrop-blur">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                          new Date(v.publishedAt),
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 px-4 py-4">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {v.title}
                    </div>
                    {v.description ? (
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {v.description}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between pt-1">
                      {v.viewCount ? (
                        <span className="text-[11px] text-muted-foreground">
                          {v.viewCount.toLocaleString("pt-BR")} visualizacoes
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Play className="size-3.5" /> Assistir
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/80 bg-muted/5 px-6 py-14 text-center">
              <YoutubeLogo className="size-10 text-muted-foreground" />
              <div className="text-sm font-semibold">Nenhum video disponivel no momento</div>
              <div className="max-w-md text-xs text-muted-foreground">
                Volte em instantes. Novas mensagens e cultos sao publicados regularmente em nosso
                canal do YouTube.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
