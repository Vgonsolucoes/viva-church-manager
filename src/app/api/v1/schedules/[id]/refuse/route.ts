import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLoggedIn } from "@/server/session-helpers";
import { respondToSchedule } from "@/server/schedule-response";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  reason: z.enum(["TRABALHO", "VIAGEM", "FAMILIAR", "SAUDE", "OUTRO"]),
  note: z.string().trim().max(1000).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Informe um motivo válido para a recusa." }, { status: 400 });
  }
  const { id } = await params;
  return respondToSchedule(auth.ctx, id, "DECLINED", parsed.data);
}
