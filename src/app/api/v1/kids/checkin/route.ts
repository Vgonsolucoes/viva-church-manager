import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import { hasPermission } from "@/server/rbac";
import {
  generateUniquePickupCode,
  resolveGuardianChildIds,
  verifyKidsCheckinPointToken,
} from "@/server/kids-checkin";
import { getActiveKidsService, NO_ACTIVE_SERVICE_MESSAGE } from "@/server/kids-services";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  childIds: z.array(z.string().min(1)).min(1).max(10),
});

type CheckinResult =
  | { childId: string; childName: string; ok: true; pickupCode: string }
  | { childId: string; childName: string; ok: false; error: string; message: string };

export async function POST(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const permErr = requirePermission(ctx, "kids:checkin:self");
  if (permErr) return permErr;

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Selecione pelo menos uma criança." },
      { status: 400 },
    );
  }

  const valid = await verifyKidsCheckinPointToken(parsed.data.token);
  if (!valid) {
    return NextResponse.json(
      { error: "INVALID_KIDS_QR", message: "QR Code inválido." },
      { status: 400 },
    );
  }

  const active = await getActiveKidsService();
  if (!active.ok) {
    return NextResponse.json(
      { error: "NO_ACTIVE_SERVICE", message: NO_ACTIVE_SERVICE_MESSAGE },
      { status: 400 },
    );
  }
  const service = active.service;

  const canWrite = hasPermission(ctx.roles, "kids:write");
  const allowedChildIds = canWrite ? null : await resolveGuardianChildIds(ctx);

  const uniqueChildIds = [...new Set(parsed.data.childIds)];
  const children = await prisma.child.findMany({
    where: { id: { in: uniqueChildIds } },
    select: { id: true, fullName: true },
  });
  const childById = new Map(children.map((c) => [c.id, c]));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existingActive = await prisma.childCheckIn.findMany({
    where: {
      childId: { in: uniqueChildIds },
      status: "CHECKED_IN",
      OR: [{ serviceScheduleId: service.id }, { checkInAt: { gte: todayStart } }],
    },
    select: { childId: true },
  });
  const alreadyCheckedIn = new Set(existingActive.map((c) => c.childId));

  const results: CheckinResult[] = [];

  for (const childId of uniqueChildIds) {
    const child = childById.get(childId);
    if (!child) {
      results.push({
        childId,
        childName: "",
        ok: false,
        error: "CHILD_NOT_FOUND",
        message: "Criança não encontrada.",
      });
      continue;
    }

    if (allowedChildIds && !allowedChildIds.has(childId)) {
      results.push({
        childId,
        childName: child.fullName,
        ok: false,
        error: "NOT_GUARDIAN",
        message: `Você não é responsável por ${child.fullName}.`,
      });
      continue;
    }

    if (alreadyCheckedIn.has(childId)) {
      results.push({
        childId,
        childName: child.fullName,
        ok: false,
        error: "ALREADY_CHECKED_IN",
        message: `${child.fullName} já está no Kids.`,
      });
      continue;
    }

    const pickupCode = await generateUniquePickupCode();
    const checkIn = await prisma.childCheckIn.create({
      data: {
        childId,
        status: "CHECKED_IN",
        pickupCode,
        createdById: ctx.user.id,
        serviceScheduleId: service.id,
      },
    });

    await createAuditLog({
      actorUserId: ctx.user.id,
      action: "CHECKIN",
      entityType: "ChildCheckIn",
      entityId: checkIn.id,
      after: {
        childId,
        serviceScheduleId: service.id,
        pickupCode,
        origin: "QR_WALL_APP",
      },
      createdById: ctx.user.id,
    });

    results.push({ childId, childName: child.fullName, ok: true, pickupCode });
  }

  const created = results.filter((r) => r.ok).length;

  return NextResponse.json(
    {
      service: {
        id: service.id,
        name: service.name,
        startTime: service.startTime,
        endTime: service.endTime,
      },
      created,
      results,
    },
    { status: created > 0 ? 201 : 200 },
  );
}
