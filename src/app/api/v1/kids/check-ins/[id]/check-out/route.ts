import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";
import {
  closeEndedKidsSessions,
  KIDS_CLOSE_REASON_CHECKED_OUT,
  KIDS_CLOSE_REASON_SERVICE_ENDED,
} from "@/server/kids-close";

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

  // Lazy close: se a sessão já foi encerrada ao fim do culto, o check-out
  // não deve ser apresentado como retirada pelo responsável.
  await closeEndedKidsSessions();

  const checkIn = await prisma.childCheckIn.findUnique({
    where: { id },
  });
  if (!checkIn) {
    return NextResponse.json({ error: "CHECKIN_NOT_FOUND" }, { status: 404 });
  }
  if (checkIn.status !== "CHECKED_IN") {
    if (checkIn.closeReason === KIDS_CLOSE_REASON_SERVICE_ENDED) {
      return NextResponse.json(
        {
          error: "SESSION_CLOSED",
          message: "Sessão encerrada automaticamente ao final do culto.",
        },
        { status: 400 },
      );
    }
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
      closeReason: KIDS_CLOSE_REASON_CHECKED_OUT,
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
