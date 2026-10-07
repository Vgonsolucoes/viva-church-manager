import { NextResponse } from "next/server";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { listPendingProjectionMessages } from "@/server/kids-projection";

export const dynamic = "force-dynamic";

// Polling da tela de projeção (seções 17–20 da spec): retorna apenas o
// necessário para o anúncio — nome da criança + mensagem + horário.
// Nenhum dado médico/sensível é exposto aqui.
export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;

  const permErr = requirePermission(logged.ctx, "kids:projection:view");
  if (permErr) return permErr;

  const url = new URL(req.url);
  const takeParam = Number(url.searchParams.get("take") ?? "20");
  const take = Number.isFinite(takeParam) ? takeParam : 20;

  const messages = await listPendingProjectionMessages(take);

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      childName: m.child.fullName,
      message: m.message,
      sentAt: m.sentAt.toISOString(),
    })),
  });
}
