"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { logAudit } from "@/server/audit";
import {
  isPublicMemberRegistrationEnabled,
  setPublicMemberRegistrationEnabled,
  PUBLIC_MEMBER_REGISTRATION_KEY,
} from "@/server/settings";

export type PublicRegistrationActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function setPublicRegistrationEnabled(
  enabled: boolean,
): Promise<PublicRegistrationActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.roles ?? []) as RoleKey[];
    if (!session?.uid || !hasPermission(roles, "settings:manage")) {
      return {
        ok: false,
        error: "Você não tem permissão para alterar as configurações do sistema.",
      };
    }

    const before = await isPublicMemberRegistrationEnabled();
    await setPublicMemberRegistrationEnabled(Boolean(enabled));

    await logAudit({
      actorUserId: session.uid,
      action: "PUBLIC_REGISTRATION_TOGGLED",
      entityType: "AppSetting",
      entityId: PUBLIC_MEMBER_REGISTRATION_KEY,
      before: { enabled: before },
      after: { enabled: Boolean(enabled) },
    });

    revalidatePath("/admin/settings/cadastro-publico");
    revalidatePath("/cadastro-temporario/membros");

    return {
      ok: true,
      message: enabled
        ? "Cadastro público ativado. O link já está recebendo novos cadastros."
        : "Cadastro público desativado. O link permanece o mesmo, mas novos cadastros estão bloqueados.",
    };
  } catch (err) {
    console.error("[settings] setPublicRegistrationEnabled falhou:", err);
    return { ok: false, error: "Falha ao salvar a configuração. Tente novamente." };
  }
}
