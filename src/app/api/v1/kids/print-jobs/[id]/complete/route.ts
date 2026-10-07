import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import {
  markKidsPrintJobFailed,
  markKidsPrintJobPrinted,
} from "@/server/kids-print";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  outcome: z.enum(["printed", "failed"]),
  error: z.string().max(500).optional(),
});

// O agente confirma o resultado da impressão local. O job sai da fila
// (PRINTED) ou fica marcado como FAILED para reimpressão manual no painel.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;

  const permErr = requirePermission(logged.ctx, "kids:write");
  if (permErr) return permErr;

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Resultado de impressão inválido." },
      { status: 400 },
    );
  }

  if (parsed.data.outcome === "printed") {
    const res = await markKidsPrintJobPrinted(id, logged.ctx.user.id);
    if (res.count === 0) {
      return NextResponse.json(
        { error: "JOB_NOT_PENDING", message: "Etiqueta já processada." },
        { status: 409 },
      );
    }
  } else {
    const res = await markKidsPrintJobFailed(
      id,
      logged.ctx.user.id,
      parsed.data.error ?? "Falha na impressão local.",
    );
    if (res.count === 0) {
      return NextResponse.json(
        { error: "JOB_NOT_PENDING", message: "Etiqueta já processada." },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
