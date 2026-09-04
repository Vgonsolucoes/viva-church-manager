import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional().nullable(),
  reason: z.enum(["DISPONIVEL", "INDISPONIVEL", "VIAGEM", "FERIAS", "TRABALHO", "OUTRO"]).optional(),
  note: z.string().max(1000).optional().nullable(),
});

async function ensureVolunteerProfile(ctx: {
  user: { id: string; memberId?: string | null; member?: { id: string } | null };
  volunteerProfile: { id: string } | null;
}): Promise<{ id: string } | null> {
  if (ctx.volunteerProfile) return ctx.volunteerProfile;

  const memberId = (ctx.user as any).memberId ?? ctx.user.member?.id;
  if (!memberId) return null;

  const vp = await prisma.volunteerProfile.upsert({
    where: { memberId },
    create: { memberId },
    update: {},
    select: { id: true },
  });
  return vp;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const vp = await ensureVolunteerProfile(ctx);
  if (!vp) {
    return NextResponse.json({ error: "VOLUNTEER_PROFILE_NOT_FOUND" }, { status: 404 });
  }

  const blockId = id;
  const existing = await prisma.volunteerAvailabilityBlock.findUnique({
    where: { id: blockId },
  });
  if (!existing) {
    return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
  }
  if (existing.volunteerId !== vp.id) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const before = { ...existing };
  const updated = await prisma.volunteerAvailabilityBlock.update({
    where: { id: blockId },
    data: {
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason,
      note: parsed.data.note,
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "UPDATE",
    entityType: "VolunteerAvailabilityBlock",
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const vp = await ensureVolunteerProfile(ctx);
  if (!vp) {
    return NextResponse.json({ error: "VOLUNTEER_PROFILE_NOT_FOUND" }, { status: 404 });
  }

  const blockId = id;
  const existing = await prisma.volunteerAvailabilityBlock.findUnique({
    where: { id: blockId },
  });
  if (!existing) {
    return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
  }
  if (existing.volunteerId !== vp.id) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  const before = { ...existing };
  await prisma.volunteerAvailabilityBlock.delete({
    where: { id: blockId },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "DELETE",
    entityType: "VolunteerAvailabilityBlock",
    entityId: blockId,
    before,
  });

  return NextResponse.json({ success: true });
}
