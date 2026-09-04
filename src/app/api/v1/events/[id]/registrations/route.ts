import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";
import { createAuditLog } from "@/server/audit";
import type { EventPaymentMethod } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const permErr = requirePermission(ctx, "calendar:read");
  if (permErr) return permErr;

  const eventId = id;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (event.isPaid) {
    return NextResponse.json(
      { error: "PAYMENT_UNAVAILABLE" },
      { status: 400 },
    );
  }

  const canWrite = hasPermission(ctx.roles, "events:write");
  if (!event.public && !canWrite) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  const unitPriceCents = event.ticketPriceCents ?? 0;
  const quantity = 1;
  const amountCents = unitPriceCents * quantity;

  const sale = await prisma.eventSale.create({
    data: {
      eventId: event.id,
      buyerName: ctx.member?.fullName ?? ctx.user.name ?? "",
      buyerEmail: ctx.user.email,
      buyerPhone: ctx.member?.phone ?? null,
      quantity,
      unitPriceCents,
      amountCents,
      paymentMethod: "PIX" as EventPaymentMethod,
      createdById: ctx.user.id,
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "EVENT_REGISTRATION",
    entityType: "EventSale",
    entityId: sale.id,
    before: null,
    after: sale,
    createdById: ctx.user.id,
  });

  return NextResponse.json(
    {
      saleId: sale.id,
      eventId: event.id,
      ticket: {
        qr_token_placeholder: "Aguardando backend de ingressos",
      },
    },
    { status: 201 },
  );
}
