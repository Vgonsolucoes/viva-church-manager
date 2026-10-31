import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { visitorRegistrationSchema } from "@/lib/visitor-registration";
import { logAudit } from "@/server/audit";

export async function registerVisitor(input: unknown) {
  const parsed = visitorRegistrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, error: "VALIDATION_ERROR", message: "Confira os dados informados.", issues: parsed.error.flatten().fieldErrors };
  const { fullName, cpf, email, phone, password } = parsed.data;
  const duplicateMessage = "Já existe um cadastro com estes dados. Entre com sua conta ou procure a administração da igreja.";
  // Never attach an existing member by CPF/email: public signup does not prove ownership.
  const [member, user] = await Promise.all([
    prisma.member.findFirst({ where: { OR: [{ cpf }, { email: { equals: email, mode: "insensitive" } }] }, select: { id: true } }),
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
  ]);
  if (member || user) return { ok: false as const, status: 409, error: "REGISTRATION_EXISTS", message: duplicateMessage };
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    // Nested create is atomic: a conflicting account cannot leave an orphan member.
    const created = await prisma.member.create({ data: {
      fullName, cpf, email, phone, type: "VISITOR", types: ["VISITOR"],
      user: { create: { name: fullName, email, passwordHash, roles: { create: { role: "MEMBER" } } } },
    }, select: { id: true } });
    await logAudit({ action: "CREATE_MOBILE_VISITOR", entityType: "Member", entityId: created.id, after: { id: created.id, type: "VISITOR", source: "APK" } });
    return { ok: true as const, status: 201, message: "Cadastro realizado! Você entrou como Novo Visitante." };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return { ok: false as const, status: 409, error: "REGISTRATION_EXISTS", message: duplicateMessage };
    throw error;
  }
}
