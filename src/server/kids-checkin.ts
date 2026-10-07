import { randomInt } from "crypto";
import { jwtVerify } from "jose";
import { requireNextAuthSecret } from "@/server/auth-jwt";
import { prisma } from "@/server/db";

/**
 * Valida o QR fixo da parede do Ministério Infantil.
 * O token é um JWT HS256 assinado com NEXTAUTH_SECRET, sem dados pessoais,
 * gerado em /admin/kids/qrcode.
 */
export async function verifyKidsCheckinPointToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, requireNextAuthSecret());
    return payload.type === "kids-checkin-point";
  } catch {
    return false;
  }
}

/**
 * Resolve os IDs das crianças vinculadas ao membro logado: primeiro pelo
 * vínculo direto ChildGuardian.memberId e, como fallback, pelo legado
 * (nome completo / telefone WhatsApp do responsável).
 */
export async function resolveGuardianChildIds(ctx: {
  member: { id: string; fullName: string; phone: string | null } | null;
}): Promise<Set<string>> {
  const member = ctx.member;
  if (!member) return new Set();

  const orConditions: (
    | { memberId: string }
    | { fullName: { equals: string; mode: "insensitive" } }
    | { phone: string }
  )[] = [{ memberId: member.id }];
  if (member.fullName) {
    orConditions.push({
      fullName: { equals: member.fullName, mode: "insensitive" },
    });
  }
  if (member.phone) orConditions.push({ phone: member.phone });

  const guardians = await prisma.childGuardian.findMany({
    where: { OR: orConditions },
    select: { childId: true },
  });
  return new Set(guardians.map((g) => g.childId));
}

/** Gera código de retirada único no dia (6 dígitos). */
export async function generateUniquePickupCode(): Promise<string> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  let code = "";
  let attempts = 0;
  do {
    code = String(randomInt(100000, 999999 + 1));
    const exists = await prisma.childCheckIn.findFirst({
      where: {
        pickupCode: code,
        checkInAt: { gte: todayStart, lte: todayEnd },
      },
      select: { id: true },
    });
    if (!exists) return code;
    attempts++;
  } while (attempts < 50);
  return code;
}
