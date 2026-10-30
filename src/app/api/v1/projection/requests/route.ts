import { NextResponse } from "next/server";
import { requireLoggedIn } from "@/server/session-helpers";
import { getProjectionAccess } from "@/server/projection-access";
import { createProjectionRequest, eligibleProjectionChildren } from "@/server/projection-requests";
import { projectionChannelSchema } from "@/lib/projection";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const channel = projectionChannelSchema.safeParse(new URL(req.url).searchParams.get("channel"));
  if (!channel.success) return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
  const access = await getProjectionAccess(logged.ctx.user.id);
  if (!access[channel.data]) return NextResponse.json({ error: "Acesso restrito ao respectivo ministério." }, { status: 403 });
  const children = channel.data === "KIDS" ? await eligibleProjectionChildren() : [];
  const history = channel.data === "KIDS"
    ? (await prisma.kidsProjectionMessage.findMany({ orderBy: { sentAt: "desc" }, take: 30, select: { id: true, message: true, status: true, sentAt: true, child: { select: { fullName: true } } } })).map(m => ({ id: m.id, subject: m.child.fullName, message: m.message, status: m.status, sentAt: m.sentAt }))
    : (await prisma.parkingProjectionMessage.findMany({ orderBy: { sentAt: "desc" }, take: 30, select: { id: true, plate: true, message: true, status: true, sentAt: true } })).map(m => ({ id: m.id, subject: m.plate, message: m.message, status: m.status, sentAt: m.sentAt }));
  return NextResponse.json({ children, history });
}

export async function POST(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const input = await req.json().catch(() => null);
  const result = await createProjectionRequest(logged.ctx.user.id, input);
  return NextResponse.json(result, { status: result.ok ? 201 : result.status });
}
