import { prisma } from "@/server/db";
import { isTempMemberIntakeEnabled } from "@/server/temp-member-intake";

export const PUBLIC_MEMBER_REGISTRATION_KEY = "publicMemberRegistrationEnabled";

// Prioridade: valor persistido no PostgreSQL (AppSetting). Se ainda não houver
// linha gravada, cai na variável de ambiente TEMP_MEMBER_INTAKE_ENABLED para
// preservar o comportamento atual de quem já configurou via EasyPanel.
// Em qualquer falha de leitura, assume DESATIVADO por segurança.
export async function isPublicMemberRegistrationEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: PUBLIC_MEMBER_REGISTRATION_KEY },
      select: { value: true },
    });
    if (row) return row.value === "true";
    return isTempMemberIntakeEnabled();
  } catch {
    return false;
  }
}

export async function setPublicMemberRegistrationEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PUBLIC_MEMBER_REGISTRATION_KEY },
    create: { key: PUBLIC_MEMBER_REGISTRATION_KEY, value: enabled ? "true" : "false" },
    update: { value: enabled ? "true" : "false" },
  });
}

export function getPublicMemberRegistrationPath(): string {
  return "/cadastro-temporario/membros";
}

export function getConfiguredAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) return null;
  return normalized;
}
