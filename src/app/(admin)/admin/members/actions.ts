"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { MemberType } from "@/generated/prisma/client";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { saveMemberAvatarUpload } from "@/server/uploads";
import { safeImageSrc } from "@/lib/safe-image-src";
import type { RoleKey } from "@/server/rbac";

export type MemberActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  memberId?: string | null;
};

const currentYear = new Date().getFullYear();

const yearField = z.preprocess((value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}, z.number().int().min(1900).max(currentYear).optional());

const cpfField = z.preprocess((value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  return digits;
}, z.string().length(11).optional());

const createMemberSchema = z.object({
  fullName: z.string().min(2),
  cpf: cpfField,
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  ministryIds: z.array(z.string()).optional(),
  types: z
    .array(z.enum(["MEMBER", "VISITOR", "NEW_MEMBER", "LEADER", "VOLUNTEER", "DISCIPLER"]))
    .min(1),
  zip: z.string().optional().or(z.literal("")),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  baptized: z.boolean().optional(),
  baptismYear: yearField,
  conversionYear: yearField,
});

const updateMemberSchema = createMemberSchema.extend({
  memberId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Super Administrador / Admin Master (reutiliza RoleKey.SUPER_ADMIN + RBAC +
// autenticação existentes: bcryptjs custo 12, campo User.passwordHash — o
// mesmo mecanismo de src/server/auth-jwt.ts e do seed).
// Regras: somente um SUPER_ADMIN pode conceder/remover SUPER_ADMIN ou alterar
// credenciais de acesso; o sistema nunca fica sem pelo menos um SUPER_ADMIN;
// senha nunca é persistida em texto puro.
// ---------------------------------------------------------------------------
function passwordPolicyError(password: string): string | null {
  if (password.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password))
    return "A senha deve conter pelo menos uma letra.";
  if (!/\d/.test(password))
    return "A senha deve conter pelo menos um número.";
  return null;
}

// Valida e prepara as credenciais ANTES de salvar o membro, para que erros
// (e-mail duplicado, senhas diferentes, política de senha) não salvem nada.
async function prepareAdminAccess(input: {
  memberUserEmail: string | null | undefined;
  loginEmailRaw: FormDataEntryValue | null;
  passwordRaw: FormDataEntryValue | null;
  passwordConfirmRaw: FormDataEntryValue | null;
}): Promise<
  | { ok: true; email?: string; passwordHash?: string }
  | { ok: false; error: string }
> {
  const hasExistingUser = typeof input.memberUserEmail === "string";
  const loginEmail = String(input.loginEmailRaw ?? "").trim().toLowerCase();
  const password = String(input.passwordRaw ?? "");
  const passwordConfirm = String(input.passwordConfirmRaw ?? "");

  let email: string | undefined;
  if (loginEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      return { ok: false, error: "E-mail de login inválido." };
    }
    if (!hasExistingUser || loginEmail !== input.memberUserEmail) {
      const existing = await prisma.user.findUnique({
        where: { email: loginEmail },
        select: { id: true },
      });
      if (existing) {
        return {
          ok: false,
          error: "Este e-mail de login já pertence a outro usuário do sistema.",
        };
      }
      email = loginEmail;
    }
  } else if (!hasExistingUser) {
    return {
      ok: false,
      error:
        "Informe o e-mail de login para criar a conta de acesso do Super Administrador.",
    };
  }

  let passwordHash: string | undefined;
  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      return { ok: false, error: "A senha e a confirmação não coincidem." };
    }
    const policyError = passwordPolicyError(password);
    if (policyError) return { ok: false, error: policyError };
    passwordHash = await bcrypt.hash(password, 12);
  } else if (!hasExistingUser) {
    return {
      ok: false,
      error:
        "Informe a senha e a confirmação para criar a conta de acesso do Super Administrador.",
    };
  }

  return { ok: true, email, passwordHash };
}

async function applySuperAdminChange(input: {
  actorUserId: string | null;
  actorIsSuperAdmin: boolean;
  memberId: string;
  memberName: string;
  memberPhotoUrl?: string | null;
  wantsSuperAdmin: boolean;
  access?: { email?: string; passwordHash?: string };
}): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const memberUser = await prisma.user.findUnique({
    where: { memberId: input.memberId },
    include: { roles: { select: { role: true } } },
  });
  const currentlySuperAdmin =
    memberUser?.roles.some((r) => r.role === "SUPER_ADMIN") ?? false;

  const accessEmail = input.access?.email;
  const accessPasswordHash = input.access?.passwordHash;
  const hasCredentialChange = Boolean(accessEmail || accessPasswordHash);

  // Nenhuma mudança de role nem de credenciais: nada a fazer.
  if (input.wantsSuperAdmin === currentlySuperAdmin && !hasCredentialChange) {
    return { ok: true };
  }

  if (!input.actorIsSuperAdmin) {
    return {
      ok: false,
      error:
        "Somente um Super Administrador pode conceder ou remover a permissão de Super Administrador.",
    };
  }

  if (input.wantsSuperAdmin) {
    if (!memberUser) {
      // Cria o User vinculado ao Member existente (credenciais já validadas).
      if (!accessEmail || !accessPasswordHash) {
        return {
          ok: false,
          error:
            "Informe e-mail de login e senha para criar a conta de acesso do Super Administrador.",
        };
      }
      const user = await prisma.user.create({
        data: {
          email: accessEmail,
          name: input.memberName,
          passwordHash: accessPasswordHash,
          memberId: input.memberId,
          imageUrl: input.memberPhotoUrl ?? null,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role: "SUPER_ADMIN" } },
        create: { userId: user.id, role: "SUPER_ADMIN" },
        update: {},
      });
      await logAudit({
        actorUserId: input.actorUserId,
        action: "SUPER_ADMIN_GRANTED",
        entityType: "User",
        entityId: user.id,
        after: {
          memberId: input.memberId,
          memberName: input.memberName,
          role: "SUPER_ADMIN",
          accountCreated: true,
          loginEmail: user.email,
        },
      });
      return { ok: true };
    }

    if (hasCredentialChange) {
      await prisma.user.update({
        where: { id: memberUser.id },
        data: {
          ...(accessEmail ? { email: accessEmail } : {}),
          ...(accessPasswordHash ? { passwordHash: accessPasswordHash } : {}),
        },
      });
    }

    await prisma.userRole.upsert({
      where: { userId_role: { userId: memberUser.id, role: "SUPER_ADMIN" } },
      create: { userId: memberUser.id, role: "SUPER_ADMIN" },
      update: {},
    });
    await logAudit({
      actorUserId: input.actorUserId,
      action: currentlySuperAdmin
        ? "SUPER_ADMIN_CREDENTIALS_UPDATED"
        : "SUPER_ADMIN_GRANTED",
      entityType: "User",
      entityId: memberUser.id,
      after: {
        memberId: input.memberId,
        memberName: input.memberName,
        role: "SUPER_ADMIN",
        accountCreated: false,
        emailChanged: Boolean(accessEmail),
        passwordChanged: Boolean(accessPasswordHash),
      },
    });
    return { ok: true };
  }

  const totalSuperAdmins = await prisma.userRole.count({
    where: { role: "SUPER_ADMIN" },
  });
  if (totalSuperAdmins <= 1) {
    return {
      ok: false,
      error:
        "Não é possível remover a permissão de Super Administrador. O sistema precisa possuir pelo menos um Super Administrador ativo.",
    };
  }
  if (memberUser) {
    await prisma.userRole.deleteMany({
      where: { userId: memberUser.id, role: "SUPER_ADMIN" },
    });
    await logAudit({
      actorUserId: input.actorUserId,
      action: "SUPER_ADMIN_REVOKED",
      entityType: "User",
      entityId: memberUser.id,
      before: {
        memberId: input.memberId,
        memberName: input.memberName,
        role: "SUPER_ADMIN",
      },
    });
  }
  return { ok: true };
}

function getSelectedTypes(types: MemberType[]) {
  const unique = Array.from(new Set(types));
  return unique.length ? unique : (["MEMBER"] as MemberType[]);
}

function getPrimaryType(types: MemberType[]) {
  if (types.includes("MEMBER")) return "MEMBER";
  return types[0] ?? "MEMBER";
}

export async function createMember(
  _prevState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const parsed = createMemberSchema.safeParse({
      fullName: formData.get("fullName"),
      cpf: formData.get("cpf"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      ministryIds: formData
        .getAll("ministryIds")
        .map((value) => String(value)),
      types: formData.getAll("types").map((value) => String(value)),
      zip: formData.get("zip"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2"),
      neighborhood: formData.get("neighborhood"),
      city: formData.get("city"),
      state: formData.get("state"),
      baptized: formData.get("baptized") === "on",
      baptismYear: formData.get("baptismYear"),
      conversionYear: formData.get("conversionYear"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error:
          "Cadastro inválido. Verifique os campos obrigatórios, CPF (11 dígitos) e anos válidos.",
      };
    }

    const photoFile = formData.get("photoFile");
    const uploadedPhotoUrlRaw = formData.get("photoUrl");
    let uploadedPhotoUrl: string | null = null;

    if (
      uploadedPhotoUrlRaw &&
      typeof uploadedPhotoUrlRaw === "string" &&
      uploadedPhotoUrlRaw.trim().length > 0
    ) {
      const candidate = uploadedPhotoUrlRaw.trim();
      if (candidate.startsWith("/uploads/") || candidate.startsWith("http")) {
        uploadedPhotoUrl = safeImageSrc(candidate);
      }
    }

    if (!uploadedPhotoUrl) {
      try {
        const file = photoFile as unknown as File | null;
        if (
          file &&
          typeof file === "object" &&
          typeof (file as { name?: unknown }).name === "string" &&
          (file as File).name.length > 0 &&
          typeof (file as { size?: unknown }).size === "number" &&
          (file as File).size > 0
        ) {
          uploadedPhotoUrl = safeImageSrc(
            await saveMemberAvatarUpload(file as File),
          );
        }
      } catch (err) {
        console.error(
          "[members] createMember: falha ao salvar foto de perfil via photoFile:",
          err,
        );
        uploadedPhotoUrl = null;
      }
    }

    const selectedTypes = getSelectedTypes(parsed.data.types);
    const primaryType = getPrimaryType(selectedTypes);
    const normalizedCpf = parsed.data.cpf ?? null;
    const baptized = Boolean(parsed.data.baptized);
    const ministryIds = Array.from(
      new Set(
        (parsed.data.ministryIds ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean),
      ),
    );
    const validMinistries = ministryIds.length
      ? await prisma.ministry.findMany({
          where: { id: { in: ministryIds }, active: true },
          select: { id: true },
        })
      : [];
    const validMinistryIds = validMinistries.map((m) => m.id);

    if (normalizedCpf) {
      const existingByCpf = await prisma.member.findUnique({
        where: { cpf: normalizedCpf },
        select: { id: true },
      });
      if (existingByCpf) {
        return {
          ok: false,
          error:
            "Já existe um membro cadastrado com este CPF. Utilize outro CPF ou edite o cadastro existente.",
        };
      }
    }

    // Super Administrador: valida permissão do ator e credenciais ANTES de
    // criar o membro, para que nenhum dado seja salvo se o acesso for inválido.
    const wantsSuperAdmin = formData.get("superAdmin") === "on";
    const actorRoles = (session?.roles ?? []) as RoleKey[];
    const actorIsSuperAdmin = actorRoles.includes("SUPER_ADMIN");
    let adminAccess: { email?: string; passwordHash?: string } | undefined;
    if (wantsSuperAdmin) {
      if (!actorIsSuperAdmin) {
        return {
          ok: false,
          error:
            "Somente um Super Administrador pode conceder a permissão de Super Administrador.",
        };
      }
      const prepared = await prepareAdminAccess({
        memberUserEmail: null,
        loginEmailRaw: formData.get("loginEmail"),
        passwordRaw: formData.get("accessPassword"),
        passwordConfirmRaw: formData.get("accessPasswordConfirm"),
      });
      if (!prepared.ok) return { ok: false, error: prepared.error };
      adminAccess = { email: prepared.email, passwordHash: prepared.passwordHash };
    }

    const member = await prisma.member.create({
      data: {
        fullName: parsed.data.fullName,
        photoUrl: uploadedPhotoUrl,
        cpf: normalizedCpf,
        email: parsed.data.email
          ? parsed.data.email.toLowerCase().trim()
          : null,
        phone: parsed.data.phone ? String(parsed.data.phone).trim() : null,
        type: primaryType,
        types: selectedTypes,
        ministryId: validMinistryIds[0] ?? null,
        memberMinistries: validMinistryIds.length
          ? {
              createMany: {
                data: validMinistryIds.map((ministryId) => ({ ministryId })),
              },
            }
          : undefined,
        zip: parsed.data.zip ? String(parsed.data.zip).trim() : null,
        addressLine1: parsed.data.addressLine1
          ? String(parsed.data.addressLine1).trim()
          : null,
        addressLine2: parsed.data.addressLine2
          ? String(parsed.data.addressLine2).trim()
          : null,
        neighborhood: parsed.data.neighborhood
          ? String(parsed.data.neighborhood).trim()
          : null,
        city: parsed.data.city ? String(parsed.data.city).trim() : null,
        state: parsed.data.state
          ? String(parsed.data.state).trim().toUpperCase().slice(0, 2)
          : null,
        baptized,
        baptismYear: baptized ? parsed.data.baptismYear ?? null : null,
        conversionYear: parsed.data.conversionYear ?? null,
      },
    });

    try {
      if (member.email && member.photoUrl) {
        const orWhere: Array<{ email?: string; memberId?: string }> = [];
        orWhere.push({ email: member.email });
        orWhere.push({ memberId: member.id });
        await prisma.user.updateMany({
          where: { OR: orWhere },
          data: { imageUrl: member.photoUrl },
        });
      }
    } catch (err) {
      console.error(
        "[members] createMember: falha ao sincronizar imagem User:",
        err,
      );
    }

    try {
      await logAudit({
        actorUserId: session?.uid ?? null,
        action: "CREATE",
        entityType: "Member",
        entityId: member.id,
        after: {
          id: member.id,
          fullName: member.fullName,
          photoUrl: member.photoUrl,
          cpf: member.cpf,
          email: member.email,
          type: member.type,
          types: member.types,
          ministryId: member.ministryId,
          zip: member.zip,
          city: member.city,
          state: member.state,
          baptized: member.baptized,
          baptismYear: member.baptismYear,
          conversionYear: member.conversionYear,
        },
      });
    } catch (err) {
      console.error(
        "[members] createMember: falha ao salvar auditoria (não bloqueia cadastro):",
        err,
      );
    }

    // Cria o User vinculado + role SUPER_ADMIN (credenciais já validadas acima).
    if (wantsSuperAdmin) {
      const superAdminResult = await applySuperAdminChange({
        actorUserId: session?.uid ?? null,
        actorIsSuperAdmin,
        memberId: member.id,
        memberName: member.fullName,
        memberPhotoUrl: member.photoUrl,
        wantsSuperAdmin: true,
        access: adminAccess,
      });
      if (!superAdminResult.ok) {
        revalidatePath("/admin/members");
        return { ok: false, error: superAdminResult.error };
      }
    }

    revalidatePath("/admin/members");
    return {
      ok: true,
      message: wantsSuperAdmin
        ? "Membro cadastrado com sucesso com acesso de Super Administrador."
        : "Membro cadastrado com sucesso.",
      memberId: member.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "desconhecido");
    console.error("[members] createMember falhou:", err);
    return {
      ok: false,
      error: `Erro ao cadastrar membro (${message}). Tente novamente.`,
    };
  }
}

export async function updateMember(
  _prevState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const parsed = updateMemberSchema.safeParse({
      memberId: formData.get("memberId"),
      fullName: formData.get("fullName"),
      cpf: formData.get("cpf"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      ministryIds: formData
        .getAll("ministryIds")
        .map((value) => String(value)),
      types: formData.getAll("types").map((value) => String(value)),
      zip: formData.get("zip"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2"),
      neighborhood: formData.get("neighborhood"),
      city: formData.get("city"),
      state: formData.get("state"),
      baptized: formData.get("baptized") === "on",
      baptismYear: formData.get("baptismYear"),
      conversionYear: formData.get("conversionYear"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error:
          "Cadastro inválido. Verifique os campos obrigatórios, CPF (11 dígitos) e anos válidos.",
      };
    }

    const photoFile = formData.get("photoFile");
    const uploadedPhotoUrlRaw = formData.get("photoUrl");
    let uploadedPhotoUrl: string | null = null;
    if (
      uploadedPhotoUrlRaw &&
      typeof uploadedPhotoUrlRaw === "string" &&
      uploadedPhotoUrlRaw.trim().length > 0
    ) {
      const candidate = uploadedPhotoUrlRaw.trim();
      if (
        candidate.startsWith("/uploads/") ||
        candidate.startsWith("http")
      ) {
        uploadedPhotoUrl = safeImageSrc(candidate);
      }
    }

    if (!uploadedPhotoUrl) {
      try {
        const file = photoFile as unknown as File | null;
        if (
          file &&
          typeof file === "object" &&
          typeof (file as { name?: unknown }).name === "string" &&
          (file as File).name.length > 0 &&
          typeof (file as { size?: unknown }).size === "number" &&
          (file as File).size > 0
        ) {
          uploadedPhotoUrl = safeImageSrc(
            await saveMemberAvatarUpload(file as File),
          );
        }
      } catch (err) {
        console.error(
          "[members] updateMember: falha ao salvar foto de perfil via photoFile:",
          err,
        );
        uploadedPhotoUrl = null;
      }
    }

    const selectedTypes = getSelectedTypes(parsed.data.types);
    const primaryType = getPrimaryType(selectedTypes);
    const normalizedCpf = parsed.data.cpf ?? null;
    const baptized = Boolean(parsed.data.baptized);
    const ministryIds = Array.from(
      new Set(
        (parsed.data.ministryIds ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean),
      ),
    );
    const validMinistries = ministryIds.length
      ? await prisma.ministry.findMany({
          where: { id: { in: ministryIds }, active: true },
          select: { id: true },
        })
      : [];
    const validMinistryIds = validMinistries.map((m) => m.id);

    const before = await prisma.member.findUnique({
      where: { id: parsed.data.memberId },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        cpf: true,
        email: true,
        phone: true,
        type: true,
        types: true,
        zip: true,
        addressLine1: true,
        addressLine2: true,
        neighborhood: true,
        city: true,
        state: true,
        baptized: true,
        baptismYear: true,
        conversionYear: true,
      },
    });

    if (!before) {
      return {
        ok: false,
        error: "Membro não encontrado para atualização.",
      };
    }

    if (normalizedCpf && normalizedCpf !== before.cpf) {
      const existingByCpf = await prisma.member.findUnique({
        where: { cpf: normalizedCpf },
        select: { id: true },
      });
      if (existingByCpf && existingByCpf.id !== before.id) {
        return {
          ok: false,
          error:
            "Já existe outro membro cadastrado com este CPF.",
        };
      }
    }

    // Super Administrador: valida permissão do ator e credenciais ANTES de
    // salvar, para que nenhum dado seja alterado se o acesso for inválido.
    const wantsSuperAdmin = formData.get("superAdmin") === "on";
    const actorRoles = (session?.roles ?? []) as RoleKey[];
    const actorIsSuperAdmin = actorRoles.includes("SUPER_ADMIN");
    let adminAccess: { email?: string; passwordHash?: string } | undefined;
    if (wantsSuperAdmin) {
      if (!actorIsSuperAdmin) {
        return {
          ok: false,
          error:
            "Somente um Super Administrador pode conceder a permissão de Super Administrador.",
        };
      }
      const existingUser = await prisma.user.findUnique({
        where: { memberId: before.id },
        select: { email: true },
      });
      const prepared = await prepareAdminAccess({
        memberUserEmail: existingUser?.email ?? null,
        loginEmailRaw: formData.get("loginEmail"),
        passwordRaw: formData.get("accessPassword"),
        passwordConfirmRaw: formData.get("accessPasswordConfirm"),
      });
      if (!prepared.ok) return { ok: false, error: prepared.error };
      adminAccess = { email: prepared.email, passwordHash: prepared.passwordHash };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextMinistryId = validMinistryIds[0] ?? null;

      await tx.memberMinistry.deleteMany({
        where: { memberId: before.id },
      });

      const next = await tx.member.update({
        where: { id: before.id },
        data: {
          fullName: parsed.data.fullName,
          photoUrl: uploadedPhotoUrl ?? before.photoUrl,
          cpf: normalizedCpf,
          email: parsed.data.email
            ? parsed.data.email.toLowerCase().trim()
            : null,
          phone: parsed.data.phone
            ? String(parsed.data.phone).trim()
            : null,
          type: primaryType,
          types: selectedTypes,
          ministryId: nextMinistryId,
          zip: parsed.data.zip ? String(parsed.data.zip).trim() : null,
          addressLine1: parsed.data.addressLine1
            ? String(parsed.data.addressLine1).trim()
            : null,
          addressLine2: parsed.data.addressLine2
            ? String(parsed.data.addressLine2).trim()
            : null,
          neighborhood: parsed.data.neighborhood
            ? String(parsed.data.neighborhood).trim()
            : null,
          city: parsed.data.city ? String(parsed.data.city).trim() : null,
          state: parsed.data.state
            ? String(parsed.data.state).trim().toUpperCase().slice(0, 2)
            : null,
          baptized,
          baptismYear: baptized ? parsed.data.baptismYear ?? null : null,
          conversionYear: parsed.data.conversionYear ?? null,
          memberMinistries: validMinistryIds.length
            ? {
                createMany: {
                  data: validMinistryIds.map((ministryId) => ({
                    ministryId,
                  })),
                },
              }
            : undefined,
        },
      });

      try {
        if (next.photoUrl) {
          const orWhere: Array<{ email?: string; memberId?: string }> = [];
          if (next.email) orWhere.push({ email: next.email });
          orWhere.push({ memberId: next.id });
          await tx.user.updateMany({
            where: { OR: orWhere },
            data: { imageUrl: next.photoUrl },
          });
        }
      } catch (err) {
        console.error(
          "[members] updateMember: falha ao sincronizar imagem User (transaction):",
          err,
        );
      }

      return next;
    });

    try {
      await logAudit({
        actorUserId: session?.uid ?? null,
        action: "UPDATE",
        entityType: "Member",
        entityId: updated.id,
        before,
        after: {
          id: updated.id,
          fullName: updated.fullName,
          photoUrl: updated.photoUrl,
          cpf: updated.cpf,
          email: updated.email,
          phone: updated.phone,
          type: updated.type,
          types: updated.types,
          ministryId: updated.ministryId,
          zip: updated.zip,
          city: updated.city,
          state: updated.state,
          baptized: updated.baptized,
          baptismYear: updated.baptismYear,
          conversionYear: updated.conversionYear,
        },
      });
    } catch (err) {
      console.error(
        "[members] updateMember: falha ao salvar auditoria (não bloqueia atualização):",
        err,
      );
    }

    // Super Administrador (aplicado após o cadastro ser salvo; validações de
    // segurança no backend: só SUPER_ADMIN altera, e nunca remove o último).
    const superAdminResult = await applySuperAdminChange({
      actorUserId: session?.uid ?? null,
      actorIsSuperAdmin,
      memberId: updated.id,
      memberName: updated.fullName,
      memberPhotoUrl: updated.photoUrl,
      wantsSuperAdmin,
      access: adminAccess,
    });
    if (!superAdminResult.ok) {
      revalidatePath("/admin/members");
      return { ok: false, error: superAdminResult.error };
    }

    revalidatePath("/admin/members");
    return {
      ok: true,
      message: "Cadastro atualizado com sucesso.",
      memberId: updated.id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "desconhecido");
    console.error("[members] updateMember falhou:", err);
    return {
      ok: false,
      error: `Erro ao atualizar membro (${message}). Tente novamente.`,
    };
  }
}
