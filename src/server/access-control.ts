import { z } from "zod";
import { prisma } from "@/server/db";
import { defaultAccessConfig, resolveAccess, WEB_MODULES, MOBILE_MODULES, type AccessConfig } from "@/lib/access-control";
import type { RoleKey } from "@/server/rbac";

export const ACCESS_SETTING_KEY = "user-access-control:v1";
const profileSchema = z.object({
  webEnabled: z.boolean(),
  web: z.record(z.string(), z.enum(["read", "write"])).refine(web => Object.keys(web).every(key => WEB_MODULES.some(m => m.key === key))),
  mobile: z.array(z.string()).refine(keys => keys.every(key => MOBILE_MODULES.some(m => m.key === key))),
  agendaScope: z.enum(["own", "all"]),
});
export const accessConfigSchema = z.object({ version: z.literal(1), types: z.record(z.string(), profileSchema), ministries: z.record(z.string(), profileSchema), roles: z.record(z.string(), profileSchema) });
export async function getAccessConfig(): Promise<AccessConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: ACCESS_SETTING_KEY } });
  if (!row) return defaultAccessConfig();
  const parsed = accessConfigSchema.safeParse(JSON.parse(row.value));
  if (!parsed.success) throw new Error("Configuração de acessos inválida.");
  return parsed.data as AccessConfig;
}
export async function getUserAccess(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    roles: { select: { role: true } },
    member: { select: { type: true, types: true, ministry: true, memberMinistries: { include: { ministry: true } }, ministriesLeading: true, volunteerProfile: { include: { ministry: true } } } },
  } });
  if (!user) return null;
  const member = user.member;
  const ministries = member ? [...(member.ministry ? [member.ministry] : []), ...(member.volunteerProfile?.ministry ? [member.volunteerProfile.ministry] : []), ...member.memberMinistries.map(m => m.ministry), ...member.ministriesLeading] : [];
  const roles = user.roles.map(r => r.role) as RoleKey[];
  return { ...resolveAccess({ roles, type: member?.type ?? null, types: member?.types ?? [], ministries }, roles.includes("SUPER_ADMIN") ? defaultAccessConfig() : await getAccessConfig()), roles, memberType: member?.type ?? null };
}

export async function assertWebPermission(permission: import("@/server/rbac").PermissionKey) {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/server/auth");
  const session = await getServerSession(authOptions);
  if (!session?.uid || !session.permissions?.includes(permission)) throw new Error("Você não tem permissão para esta operação.");
  return { ...session, uid: session.uid };
}
