import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { hasPermission } from "@/server/rbac";

export const dynamic = "force-dynamic";

const optionalText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null));

const createChildSchema = z.object({
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

function serializeChild(child: {
  id: string;
  fullName: string;
  birthDate: Date | null;
  sex: string | null;
  photoUrl: string | null;
  allergies: string | null;
  medications: string | null;
  specialNeeds: string | null;
  emergencyContact: string | null;
  notes: string | null;
  guardians: {
    id: string;
    fullName: string;
    phone: string | null;
    relationship: string | null;
  }[];
}) {
  return {
    id: child.id,
    fullName: child.fullName,
    birthDate: child.birthDate,
    sex: child.sex,
    photoUrl: child.photoUrl,
    classroom: null,
    allergies: child.allergies,
    medications: child.medications,
    specialNeeds: child.specialNeeds,
    emergencyContact: child.emergencyContact,
    notes: child.notes,
    guardians: child.guardians.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      phone: g.phone,
      relationship: g.relationship,
    })),
    pendingCheckIn: null,
  };
}

export async function POST(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  if (!hasPermission(ctx.roles, "kids:checkin:self")) {
    const err = requirePermission(ctx, "kids:checkin:self");
    if (err) return err;
  }

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = createChildSchema.safeParse(body);
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
  const child = await prisma.child.create({
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
      guardians: {
        create: {
          memberId: ctx.member.id,
          fullName: ctx.member.fullName,
          phone: ctx.member.phone,
          relationship: "Responsável",
        },
      },
    },
    include: { guardians: true },
  });

  return NextResponse.json(serializeChild(child), { status: 201 });
}
