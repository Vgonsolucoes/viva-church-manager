import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";
import { generateUniquePickupCode } from "@/server/kids-checkin";
import { getActiveKidsService } from "@/server/kids-services";
import { enqueueKidsPrintJobsForCheckin } from "@/server/kids-print";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const childId = id;

  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const hasKidsWrite = hasPermission(ctx.roles, "kids:write");

  let isGuardian = false;
  if (!hasKidsWrite) {
    const memberName = ctx.member?.fullName;
    const memberPhone = ctx.member?.phone;
    if (!memberName && !memberPhone) {
      return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    }
    const where: any = { childId, OR: [] };
    if (memberName) {
      where.OR.push({
        fullName: { equals: memberName, mode: "insensitive" },
      });
    }
    if (memberPhone) {
      where.OR.push({ phone: memberPhone });
    }
    const guardian = await prisma.childGuardian.findFirst({ where });
    isGuardian = !!guardian;
    if (!isGuardian) {
      return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    }
  } else {
    const permErr = requirePermission(ctx, "kids:write");
    if (permErr) return permErr;
  }

  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child) {
    return NextResponse.json({ error: "CHILD_NOT_FOUND" }, { status: 404 });
  }

  // Vincula ao culto ativo quando houver (check-in manual/legado).
  const active = await getActiveKidsService();
  const serviceScheduleId = active.ok ? active.service.id : null;

  const pickupCode = await generateUniquePickupCode();

  const checkIn = await prisma.childCheckIn.create({
    data: {
      childId,
      status: "CHECKED_IN",
      pickupCode,
      createdById: ctx.user.id,
      serviceScheduleId,
    },
    include: { child: true },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "CHECKIN",
    entityType: "ChildCheckIn",
    entityId: checkIn.id,
    after: checkIn,
    createdById: ctx.user.id,
  });

  // Impressão desacoplada: falha na fila NÃO pode impedir o check-in.
  try {
    await enqueueKidsPrintJobsForCheckin(checkIn.id);
  } catch (err) {
    console.error("[kids-print] Falha ao enfileirar etiquetas:", err);
  }

  return NextResponse.json(
    {
      checkInId: checkIn.id,
      pickupCode: checkIn.pickupCode,
      status: "CHECKED_IN",
      child: checkIn.child,
    },
    { status: 201 },
  );
}
