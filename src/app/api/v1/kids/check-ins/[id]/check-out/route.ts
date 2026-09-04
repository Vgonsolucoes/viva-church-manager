import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pickupCode: z.string().length(6),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const hasKidsWrite = hasPermission(ctx.roles, "kids:write");

  const checkIn = await prisma.childCheckIn.findUnique({
    where: { id },
  });
  if (!checkIn) {
    return NextResponse.json({ error: "CHECKIN_NOT_FOUND" }, { status: 404 });
  }
  if (checkIn.status !== "CHECKED_IN") {
    return NextResponse.json({ error: "INVALID_CHECKIN_STATUS" }, { status: 400 });
  }

  if (!hasKidsWrite) {
    if (checkIn.pickupCode !== parsed.data.pickupCode) {
      return NextResponse.json({ error: "INVALID_PICKUP_CODE" }, { status: 400 });
    }
  } else {
    const permErr = requirePermission(ctx, "kids:write");
    if (permErr) return permErr;
  }

  const before = { ...checkIn };

  const updated = await prisma.childCheckIn.update({
    where: { id },
    data: {
      status: "CHECKED_OUT",
      checkOutAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "CHECKOUT",
    entityType: "ChildCheckIn",
    entityId: updated.id,
    before,
    after: updated,
    createdById: ctx.user.id,
  });

  return NextResponse.json({ ok: true, checkIn: updated });
}
