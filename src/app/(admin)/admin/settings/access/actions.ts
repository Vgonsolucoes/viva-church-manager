"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { accessConfigSchema, ACCESS_SETTING_KEY } from "@/server/access-control";
import { defaultAccessConfig, MEMBER_TYPES } from "@/lib/access-control";
import { rolePermissions } from "@/server/rbac";
import { logAudit } from "@/server/audit";

export async function saveAccessProfile(group: "types" | "ministries" | "roles", key: string, profile: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.uid || !session.roles?.includes("SUPER_ADMIN")) return { ok: false, message: "Somente o Super Administrador pode alterar os acessos." };
  if (!["types", "ministries", "roles"].includes(group) || key === "SUPER_ADMIN") return { ok: false, message: "Perfil inválido." };
  if ((group === "types" && !Object.hasOwn(MEMBER_TYPES, key)) || (group === "roles" && !Object.hasOwn(rolePermissions, key)) || (group === "ministries" && !await prisma.ministry.findUnique({ where: { id: key }, select: { id: true } }))) return { ok: false, message: "Cadastro não encontrado." };
  const checked = accessConfigSchema.safeParse({ ...defaultAccessConfig(), [group]: { [key]: profile } });
  if (!checked.success) return { ok: false, message: "Confira as opções selecionadas." };
  const data = checked.data[group][key];
  try {
    const before = await prisma.$transaction(async tx => {
      const row = await tx.appSetting.findUnique({ where: { key: ACCESS_SETTING_KEY } });
      const config = row ? accessConfigSchema.parse(JSON.parse(row.value)) : defaultAccessConfig();
      const previous = config[group][key];
      config[group][key] = data;
      await tx.appSetting.upsert({ where: { key: ACCESS_SETTING_KEY }, create: { key: ACCESS_SETTING_KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
      return previous;
    }, { isolationLevel: "Serializable" });
    await logAudit({ actorUserId: session.uid, action: "UPDATE", entityType: "AccessControl", entityId: `${group}:${key}`, before, after: data });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Acessos salvos. As próximas operações já usam as novas regras. No APK, atualize a tela para renovar o menu." };
  } catch (error) {
    console.error("[access-control] Falha ao salvar regras", error);
    return { ok: false, message: "Não foi possível salvar. Atualize a página e tente novamente." };
  }
}
