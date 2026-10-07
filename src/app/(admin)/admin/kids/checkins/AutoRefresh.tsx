"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza o painel a cada 5s para acompanhar os check-ins do culto. */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
