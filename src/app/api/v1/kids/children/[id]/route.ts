import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const optionalText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null));

const updateChildSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo da criança."),
  birthDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const date = new Date(v);
      return Number.isNaN(date.getTime()) ? null : date;
    }),
  sex: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.startsWith("/uploads/") ? v : null)),
  allergies: optionalText,
  medications: optionalText,
  specialNeeds: optionalText,
  emergencyContact: optionalText,
  notes: optionalText,
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;
  const { id } = await context.params;

  if (!ctx.member) {
    return NextResponse.json(
      {
        error: "MEMBER_REQUIRED",
        message:
          "Seu usuário não está vinculado a um membro. Procure a secretaria da igreja.",
      },
      { status: 400 },
    );
  }

  const child = await prisma.child.findUnique({
    where: { id },
    include: { guardians: true },
  });
  if (!child) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const memberName = ctx.member.fullName;
  const memberPhone = ctx.member.phone;
  const linkedByMember = child.guardians.some(
    (g) => g.memberId === ctx.member!.id,
  );
  const legacyMatched =
    !linkedByMember &&
    child.guardians.some(
      (g) =>
        (memberName &&
          g.fullName.trim().toLowerCase() ===
            memberName.trim().toLowerCase()) ||
        (memberPhone && g.phone === memberPhone),
    );
  const canManage = hasPermission(ctx.roles, "kids:write");

  if (!linkedByMember && !legacyMatched && !canManage) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = updateChildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Migração do legado: responsável que casou por nome/telefone passa a ser vinculado por memberId
  if (legacyMatched) {
    await prisma.childGuardian.create({
      data: {
        childId: child.id,
        memberId: ctx.member.id,
        fullName: ctx.member.fullName,
        phone: ctx.member.phone,
        relationship: "Responsável",
      },
    });
  }

  const updated = await prisma.child.update({
    where: { id: child.id },
    data: {
      fullName: data.fullName,
      birthDate: data.birthDate,
      sex: data.sex ?? null,
      photoUrl: data.photoUrl,
      allergies: data.allergies,
      medications: data.medications,
      specialNeeds: data.specialNeeds,
      emergencyContact: data.emergencyContact,
      notes: data.notes,
    },
    include: { guardians: true },
  });

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    birthDate: updated.birthDate,
    sex: updated.sex,
    photoUrl: updated.photoUrl,
    classroom: null,
    allergies: updated.allergies,
    medications: updated.medications,
    specialNeeds: updated.specialNeeds,
    emergencyContact: updated.emergencyContact,
    notes: updated.notes,
    guardians: updated.guardians.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      phone: g.phone,
      relationship: g.relationship,
    })),
    pendingCheckIn: null,
  });
}
