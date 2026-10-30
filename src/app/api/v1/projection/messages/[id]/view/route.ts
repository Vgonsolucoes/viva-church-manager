import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { prisma } from "@/server/db";
import { projectionChannelSchema } from "@/lib/projection";
import { markProjectionMessageViewed } from "@/server/kids-projection";
import { logAudit } from "@/server/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const body = await req.json().catch(() => null);
  const channel = projectionChannelSchema.safeParse(body?.channel);
  if (!channel.success) return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
  const permission = channel.data === "KIDS" ? "kids:projection:view" : "parking:projection:view";
  if (!hasPermission(logged.ctx.roles, permission)) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  const { id } = await params;
  const result = channel.data === "KIDS"
    ? await markProjectionMessageViewed(id, logged.ctx.user.id)
    : await prisma.parkingProjectionMessage.updateMany({ where: { id, status: "PENDING" }, data: { status: "VIEWED", viewedAt: new Date(), viewedById: logged.ctx.user.id } });
  if (!result.count) return NextResponse.json({ error: "Mensagem já visualizada ou não encontrada." }, { status: 409 });
  await logAudit({ actorUserId: logged.ctx.user.id, action: "PROJECTION_MESSAGE_VIEWED", entityType: channel.data === "KIDS" ? "KidsProjectionMessage" : "ParkingProjectionMessage", entityId: id });
  return NextResponse.json({ ok: true });
}
