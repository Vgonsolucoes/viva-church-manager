import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { verifyKidsCheckinPointToken } from "@/server/kids-checkin";
import { getActiveKidsService, NO_ACTIVE_SERVICE_MESSAGE } from "@/server/kids-services";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
});

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
      { error: "INVALID_BODY", message: "QR Code não informado." },
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

  return NextResponse.json({
    valid: true,
    service: {
      id: active.service.id,
      name: active.service.name,
      dayOfWeek: active.service.dayOfWeek,
      startTime: active.service.startTime,
      endTime: active.service.endTime,
    },
  });
}
