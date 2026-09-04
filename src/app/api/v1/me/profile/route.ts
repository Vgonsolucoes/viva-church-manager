import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  neighborhood: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  zip: z.string().length(8).nullable().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const permErr = requirePermission(ctx, "profile:self:edit");
  if (permErr) return permErr;

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

  const data = parsed.data;
  const userId = ctx.user.id;
  const memberId = ctx.member?.id ?? null;

  const beforeUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, imageUrl: true },
  });
  const beforeMember = memberId
    ? await prisma.member.findUnique({
        where: { id: memberId },
        select: {
          phone: true,
          photoUrl: true,
          addressLine1: true,
          addressLine2: true,
          neighborhood: true,
          city: true,
          state: true,
          zip: true,
        },
      })
    : null;

  if (data.email !== undefined && data.email !== null) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
    }
  }

  const userUpdate: { email?: string; imageUrl?: string | null } = {};
  if (data.email !== undefined && data.email !== null) userUpdate.email = data.email;
  if (data.photoUrl !== undefined) userUpdate.imageUrl = data.photoUrl;

  const memberUpdate: {
    phone?: string | null;
    photoUrl?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } = {};
  if (data.phone !== undefined) memberUpdate.phone = data.phone;
  if (data.photoUrl !== undefined) memberUpdate.photoUrl = data.photoUrl;
  if (data.addressLine1 !== undefined) memberUpdate.addressLine1 = data.addressLine1;
  if (data.addressLine2 !== undefined) memberUpdate.addressLine2 = data.addressLine2;
  if (data.neighborhood !== undefined) memberUpdate.neighborhood = data.neighborhood;
  if (data.city !== undefined) memberUpdate.city = data.city;
  if (data.state !== undefined) memberUpdate.state = data.state;
  if (data.zip !== undefined) memberUpdate.zip = data.zip;

  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userUpdate });
  }
  if (memberId && Object.keys(memberUpdate).length > 0) {
    await prisma.member.update({ where: { id: memberId }, data: memberUpdate });
  }

  const afterUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, imageUrl: true },
  });
  const afterMember = memberId
    ? await prisma.member.findUnique({
        where: { id: memberId },
        select: {
          phone: true,
          photoUrl: true,
          addressLine1: true,
          addressLine2: true,
          neighborhood: true,
          city: true,
          state: true,
          zip: true,
        },
      })
    : null;

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "PROFILE_UPDATED",
    entityType: memberId ? "Member" : "User",
    entityId: memberId ?? userId,
    before: { user: beforeUser, member: beforeMember },
    after: { user: afterUser, member: afterMember },
    createdById: ctx.user.id,
  });

  return NextResponse.json({ ok: true });
}
