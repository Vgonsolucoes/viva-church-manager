import { NextResponse } from "next/server";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { markProjectionMessageViewed } from "@/server/kids-projection";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

// O operador marca VISUALIZADO (seção 19): apenas retira o alerta da tela,
// sem enviar qualquer resposta ao Ministério Infantil (seção 21).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;

  const permErr = requirePermission(logged.ctx, "kids:projection:view");
  if (permErr) return permErr;

  const res = await markProjectionMessageViewed(id, logged.ctx.user.id);
  if (res.count === 0) {
    return NextResponse.json(
      { error: "MESSAGE_NOT_PENDING", message: "Mensagem já visualizada." },
      { status: 409 },
    );
  }

  await createAuditLog({
    actorUserId: logged.ctx.user.id,
    action: "PROJECTION_MESSAGE_VIEWED",
    entityType: "KidsProjectionMessage",
    entityId: id,
    createdById: logged.ctx.user.id,
  });

  return NextResponse.json({ ok: true });
}
