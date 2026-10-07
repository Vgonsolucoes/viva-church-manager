"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SafeAvatarImage } from "@/components/ui/SafeAvatarImage";
import { safeImageSrcOrUndefined } from "@/lib/safe-image-src";

export type LeaderPickerMember = {
  id: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function MemberAvatar(props: { member: LeaderPickerMember; sizeClass: string }) {
  const src = safeImageSrcOrUndefined(props.member.photoUrl);
  const fallback = (
    <div
      className={`flex ${props.sizeClass} items-center justify-center rounded-2xl bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}
    >
      {initialsOf(props.member.fullName)}
    </div>
  );
  if (!src) return fallback;
  return (
    <SafeAvatarImage
      src={src}
      alt={props.member.fullName}
      className={`${props.sizeClass} rounded-2xl object-cover`}
      fallback={fallback}
    />
  );
}

export function LeaderPicker(props: {
  members: LeaderPickerMember[];
  defaultLeaderId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    props.defaultLeaderId ?? "",
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () => props.members.find((m) => m.id === selectedId) ?? null,
    [props.members, selectedId],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return props.members
      .filter((m) => m.id !== selectedId)
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [props.members, query, selectedId]);

  return (
    <div className="space-y-2">
      <input type="hidden" name="leaderId" value={selectedId} />

      {selected && !searching ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar member={selected} sizeClass="size-10" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{selected.fullName}</div>
              <div className="truncate text-xs text-muted-foreground">
                Líder do Ministério{selected.email ? ` • ${selected.email}` : ""}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSearching(true);
                setQuery("");
              }}
            >
              Trocar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSelectedId("");
                setSearching(false);
                setQuery("");
              }}
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Pesquisar membro por nome ou e-mail…"
            className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          {query.trim() ? (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border bg-background p-2">
              {results.length ? (
                results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id);
                      setSearching(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/20"
                  >
                    <MemberAvatar member={m} sizeClass="size-8" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.fullName}</div>
                      {m.email ? (
                        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Nenhum membro encontrado para &quot;{query.trim()}&quot;.
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Digite para pesquisar. O líder precisa ser um membro já cadastrado.
            </div>
          )}
          {selected && searching ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSearching(false);
                setQuery("");
              }}
            >
              Manter líder atual ({selected.fullName})
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
