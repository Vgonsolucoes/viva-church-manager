"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type DisciplerOption = { value: string; label: string };

export function NetworkScopeControls(props: {
  canViewAll: boolean;
  disciplerOptions: DisciplerOption[];
  effectiveRede: string;
  effectiveAbrangencia: "direta" | "completa";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const rede = searchParams.get("rede") ?? props.effectiveRede;
  const abrangencia = searchParams.get("abrangencia") ?? props.effectiveAbrangencia;
  const showScope = rede !== "todas";

  function replaceWith(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParamsString);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    // Ao mudar o escopo da rede, sempre volta para a lista (sem vínculo aberto) e página 1.
    params.delete("page");
    params.delete("vinculo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">Visualizar Rede</div>
        {props.canViewAll ? (
          <select
            value={rede}
            onChange={(event) => replaceWith({ rede: event.target.value })}
            className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
          >
            <option value="minha">Minha Rede</option>
            <option value="todas">Todas as Redes</option>
            <optgroup label="Selecionar Discipulador">
              {props.disciplerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        ) : (
          <div className="flex h-11 w-full items-center rounded-2xl border border-border/80 bg-muted/10 px-3 text-sm text-muted-foreground">
            Minha Rede
          </div>
        )}
      </div>

      {showScope ? (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Abrangência da Rede</div>
          <select
            value={abrangencia}
            onChange={(event) => replaceWith({ abrangencia: event.target.value })}
            className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm"
          >
            <option value="completa">Toda a rede</option>
            <option value="direta">Discípulos diretos</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
