"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { simulateRaffle } from "../../actions";

type DrawState = { number?: number; error?: string };

export function DrawSimulation({ raffleId }: { raffleId: string }) {
  const [state, draw, pending] = useActionState<DrawState, FormData>(
    async () => simulateRaffle(raffleId),
    {},
  );
  return (
    <form action={draw} className="space-y-4">
      <output aria-live="polite" className="block rounded-2xl border border-border bg-background px-6 py-8">
        {pending ? "Sorteando…" : state.error ?? (
          <span className="text-5xl font-bold tabular-nums text-primary">{state.number ?? "—"}</span>
        )}
      </output>
      <Button type="submit" disabled={pending}>{state.number === undefined ? "Sortear número" : "Sortear novamente"}</Button>
    </form>
  );
}
