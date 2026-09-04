import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  reason: z.enum(["DISPONIVEL", "INDISPONIVEL", "VIAGEM", "FERIAS", "TRABALHO", "OUTRO"]),
  note: z.string().max(1000).optional(),
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

export async function GET(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const vp = await ensureVolunteerProfile(ctx);
  if (!vp) return NextResponse.json([]);

  const blocks = await prisma.volunteerAvailabilityBlock.findMany({
    where: { volunteerId: vp.id },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(blocks);
}

export async function POST(req: Request) {
  const auth = await requireLoggedIn(req);
  if (!auth.ok) return auth.error;
  const { ctx } = auth;

  const vp = await ensureVolunteerProfile(ctx);
  if (!vp) {
    return NextResponse.json({ error: "VOLUNTEER_PROFILE_NOT_FOUND" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const block = await prisma.volunteerAvailabilityBlock.create({
    data: {
      volunteerId: vp.id,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
    },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "CREATE",
    entityType: "VolunteerAvailabilityBlock",
    entityId: block.id,
    after: block,
  });

  return NextResponse.json(block, { status: 201 });
}
