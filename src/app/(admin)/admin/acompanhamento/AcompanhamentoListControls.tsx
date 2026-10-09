"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type StageOption = { value: string; label: string };

export function AcompanhamentoListControls({ stageOptions }: { stageOptions: StageOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function replaceWith(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParamsString);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      replaceWith({ q: value.trim() || null, page: null });
    }, 400);
  }

  const status = searchParams.get("status") ?? "all";
  const stage = searchParams.get("stage") ?? "all";
  const take = searchParams.get("take") ?? "20";

  const selectClass =
    "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_170px_210px_110px]">
      <input
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="🔍 Buscar pessoa em acompanhamento..."
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        aria-label="Pesquisar por nome, telefone WhatsApp ou e-mail"
      />
      <select
        value={status}
        onChange={(event) =>
          replaceWith({ status: event.target.value === "all" ? null : event.target.value, page: null })
        }
        className={selectClass}
        aria-label="Filtrar por status"
      >
        <option value="all">Status: Todos</option>
        <option value="in_progress">Em andamento</option>
        <option value="completed">Concluído</option>
      </select>
      <select
        value={stage}
        onChange={(event) =>
          replaceWith({ stage: event.target.value === "all" ? null : event.target.value, page: null })
        }
        className={selectClass}
        aria-label="Filtrar por etapa atual"
      >
        <option value="all">Etapa: Todas</option>
        {stageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        value={take}
        onChange={(event) => replaceWith({ take: event.target.value === "20" ? null : event.target.value, page: null })}
        className={selectClass}
        aria-label="Registros por página"
      >
        <option value="10">10 por pág.</option>
        <option value="20">20 por pág.</option>
        <option value="50">50 por pág.</option>
      </select>
    </div>
  );
}
