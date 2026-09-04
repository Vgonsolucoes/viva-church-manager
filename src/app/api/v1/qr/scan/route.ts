import { NextResponse } from "next/server";
import { z } from "zod";
import { jwtVerify } from "jose";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { requireNextAuthSecret } from "@/server/auth-jwt";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  qr_payload: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { qr_payload } = parsed.data;
  const secret = requireNextAuthSecret();

  let entityId: string | null = null;
  let result: { valid: boolean; kind?: string; member?: { id: string; name: string; photo?: string | null }; asset?: unknown; error?: string };

  try {
    const { payload } = await jwtVerify(qr_payload, secret, {
      algorithms: ["HS256"],
    });
    if (payload.type === "member-card" && payload.sub) {
      const member = await prisma.member.findUnique({
        where: { id: String(payload.sub) },
        select: { id: true, fullName: true, photoUrl: true },
      });
      if (member) {
        entityId = member.id;
        result = {
          valid: true,
          kind: "member-card",
          member: {
            id: member.id,
            name: member.fullName,
            photo: member.photoUrl ?? null,
          },
        };
      } else {
        result = { valid: false, error: "INVALID_QR" };
      }
    } else {
      result = { valid: false, error: "INVALID_QR" };
    }
  } catch {
    if (qr_payload.startsWith("asset:")) {
      const assetIdOrCode = qr_payload.slice("asset:".length);
      const asset = await prisma.asset.findFirst({
        where: {
          OR: [{ id: assetIdOrCode }, { code: assetIdOrCode }],
        },
      });
      if (asset) {
        entityId = asset.id;
        result = {
          valid: true,
          kind: "asset",
          asset: {
            id: asset.id,
            code: asset.code,
            name: asset.name,
            category: asset.category,
            location: asset.location,
            status: asset.status,
          },
        };
      } else {
        result = { valid: false, error: "INVALID_QR" };
      }
    } else {
      result = { valid: false, error: "INVALID_QR" };
    }
  }

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "QR_SCAN",
    entityType: "QRScan",
    entityId,
    createdById: ctx.user.id,
  });

  return NextResponse.json(result);
}
