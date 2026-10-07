"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { hasPermission, type RoleKey } from "@/server/rbac";

export type MinistryActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

const ministrySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  active: z.boolean().optional(),
  leaderId: z.string().optional().or(z.literal("")),
});

const updateMinistrySchema = ministrySchema.extend({
  ministryId: z.string().min(1),
});

async function requireMinistriesWrite(): Promise<
  | { ok: true; actorUserId: string | null }
  | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  if (!session?.uid) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  if (!hasPermission(roles, "ministries:write")) {
    return { ok: false, error: "Você não tem permissão para gerenciar ministérios." };
  }
  return { ok: true, actorUserId: session.uid };
}

async function resolveLeaderId(raw: string | undefined): Promise<string | null> {
  const leaderId = String(raw ?? "").trim();
  if (!leaderId) return null;
  const member = await prisma.member.findUnique({
    where: { id: leaderId },
    select: { id: true },
  });
  return member ? member.id : null;
}

async function leaderSummary(leaderId: string | null) {
  if (!leaderId) return null;
  const leader = await prisma.member.findUnique({
    where: { id: leaderId },
    select: { id: true, fullName: true },
  });
  return leader ? { id: leader.id, fullName: leader.fullName } : { id: leaderId, fullName: null };
}

export async function createMinistry(
  _prevState: MinistryActionResult,
  formData: FormData,
): Promise<MinistryActionResult> {
  const auth = await requireMinistriesWrite();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = ministrySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    leaderId: formData.get("leaderId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos. Informe um nome com pelo menos 2 caracteres." };
  }

  const leaderId = await resolveLeaderId(parsed.data.leaderId);
  if (String(parsed.data.leaderId ?? "").trim() && !leaderId) {
    return { ok: false, error: "Membro selecionado como líder não foi encontrado." };
  }

  try {
    const ministry = await prisma.ministry.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description ? parsed.data.description.trim() : null,
        active: true,
        leaderId,
      },
    });

    await logAudit({
      actorUserId: auth.actorUserId,
      action: "CREATE",
      entityType: "Ministry",
      entityId: ministry.id,
      after: {
        id: ministry.id,
        name: ministry.name,
        active: ministry.active,
        leader: await leaderSummary(ministry.leaderId),
      },
    });

    revalidatePath("/admin/ministries");
    return { ok: true, message: "Ministério criado com sucesso." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "desconhecido");
    if (message.includes("Unique constraint")) {
      return { ok: false, error: "Já existe um ministério com este nome." };
    }
    console.error("[ministries] createMinistry falhou:", err);
    return { ok: false, error: `Erro ao criar ministério (${message}).` };
  }
}

export async function updateMinistry(
  _prevState: MinistryActionResult,
  formData: FormData,
): Promise<MinistryActionResult> {
  const auth = await requireMinistriesWrite();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = updateMinistrySchema.safeParse({
    ministryId: formData.get("ministryId"),
    name: formData.get("name"),
    description: formData.get("description"),
    active: formData.get("active") === "on",
    leaderId: formData.get("leaderId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos. Informe um nome com pelo menos 2 caracteres." };
  }

  const before = await prisma.ministry.findUnique({
    where: { id: parsed.data.ministryId },
    select: { id: true, name: true, description: true, active: true, leaderId: true },
  });
  if (!before) {
    return { ok: false, error: "Ministério não encontrado para atualização." };
  }

  const leaderId = await resolveLeaderId(parsed.data.leaderId);
  if (String(parsed.data.leaderId ?? "").trim() && !leaderId) {
    return { ok: false, error: "Membro selecionado como líder não foi encontrado." };
  }

  try {
    const updated = await prisma.ministry.update({
      where: { id: before.id },
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description ? parsed.data.description.trim() : null,
        active: parsed.data.active ?? true,
        leaderId,
      },
    });

    const leaderChanged = before.leaderId !== updated.leaderId;
    await logAudit({
      actorUserId: auth.actorUserId,
      action: leaderChanged ? "LEADER_CHANGED" : "UPDATE",
      entityType: "Ministry",
      entityId: updated.id,
      before: {
        name: before.name,
        active: before.active,
        leader: await leaderSummary(before.leaderId),
      },
      after: {
        name: updated.name,
        active: updated.active,
        leader: await leaderSummary(updated.leaderId),
      },
    });

    revalidatePath("/admin/ministries");
    return { ok: true, message: "Ministério atualizado com sucesso." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "desconhecido");
    if (message.includes("Unique constraint")) {
      return { ok: false, error: "Já existe um ministério com este nome." };
    }
    console.error("[ministries] updateMinistry falhou:", err);
    return { ok: false, error: `Erro ao atualizar ministério (${message}).` };
  }
}
