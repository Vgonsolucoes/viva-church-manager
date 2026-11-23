import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLoggedIn } from "@/server/session-helpers";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";

export async function POST(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  if (!auth.ctx.member)
    return NextResponse.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
  const input = z
    .object({ enabled: z.boolean() })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  await prisma.arrivalConsent.upsert({
    where: { memberId: auth.ctx.member.id },
    create: { memberId: auth.ctx.member.id, enabled: input.data.enabled },
    update: input.data,
  });
  await logAudit({
    actorUserId: auth.ctx.user.id,
    action: input.data.enabled ? "OPT_IN" : "OPT_OUT",
    entityType: "ArrivalConsent",
    entityId: auth.ctx.member.id,
  });
  return NextResponse.json({ ok: true });
}
