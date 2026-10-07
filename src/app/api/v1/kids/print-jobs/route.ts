import { NextResponse } from "next/server";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { getKidsPrintConfig, listPendingKidsPrintJobs } from "@/server/kids-print";

export const dynamic = "force-dynamic";

// Consumido pelo agente de impressão (navegador da recepção). Retorna os jobs
// pendentes mais antigos com o snapshot (payload) necessário para renderizar
// as etiquetas localmente.
export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;

  const permErr = requirePermission(logged.ctx, "kids:write");
  if (permErr) return permErr;

  const url = new URL(req.url);
  const takeParam = Number(url.searchParams.get("take") ?? "10");
  const take = Number.isFinite(takeParam) ? takeParam : 10;

  const [config, jobs] = await Promise.all([
    getKidsPrintConfig(),
    listPendingKidsPrintJobs(take),
  ]);

  return NextResponse.json({
    config: { labelWidthMm: config.labelWidthMm, enabled: config.enabled },
    jobs: jobs.map((j) => ({
      id: j.id,
      labelType: j.labelType,
      copies: j.copies,
      payload: j.payload,
      createdAt: j.createdAt.toISOString(),
    })),
  });
}
