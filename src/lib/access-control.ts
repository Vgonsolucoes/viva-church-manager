import { allPermissionKeysArray, rolePermissions, type PermissionKey, type RoleKey } from "@/server/rbac";

export const MEMBER_TYPES = { MEMBER: "Membro", VISITOR: "Visitante", NEW_MEMBER: "Novo membro", VOLUNTEER: "Voluntário", LEADER: "Líder", DISCIPLER: "Discipulador", PASTOR: "Pastor" } as const;
export const WEB_MODULES = [
  { key: "dashboard", label: "Painel", path: "/admin", read: ["dashboard:view"], write: [] },
  { key: "calendar", label: "Agenda", path: "/admin/calendar", read: ["calendar:read"], write: ["calendar:write"] },
  { key: "members", label: "Membros", path: "/admin/members", read: ["members:read"], write: ["members:write"] },
  { key: "followup", label: "Acompanhamento", path: "/admin/acompanhamento", read: ["followup:read"], write: ["followup:write"] },
  { key: "volunteers", label: "Voluntários", path: "/admin/volunteers", read: ["volunteers:read"], write: ["volunteers:write"] },
  { key: "schedules", label: "Escalas", path: "/admin/schedules", read: ["schedules:read"], write: ["schedules:write"] },
  { key: "ministries", label: "Ministérios", path: "/admin/ministries", read: ["ministries:read"], write: ["ministries:write"] },
  { key: "services", label: "Cultos Fixos", path: "/admin/cultos-fixos", read: ["events:read"], write: ["events:write"] },
  { key: "events", label: "Eventos", path: "/admin/events", read: ["events:read"], write: ["events:write"] },
  { key: "courses", label: "Cursos", path: "/admin/courses", read: ["courses:read"], write: ["courses:write"] },
  { key: "cells", label: "Células e reuniões", path: "/admin/cells", read: ["cells:read"], write: ["cells:write"] },
  { key: "discipleships", label: "Discipulados", path: "/admin/discipleships", read: ["discipleships:read", "discipleship:my:read"], write: ["discipleships:write", "discipleship:my:write"] },
  { key: "kids", label: "Ministério Infantil", path: "/admin/kids", read: ["kids:read"], write: ["kids:write", "kids:manage"] },
  { key: "parking", label: "Estacionamento", path: "/admin/parking", read: ["parking:read"], write: ["parking:write"] },
  { key: "lostfound", label: "Achados e perdidos", path: "/admin/lost-found", read: ["lostfound:read"], write: ["lostfound:write"] },
  { key: "assets", label: "Patrimônio", path: "/admin/assets", read: ["assets:read"], write: ["assets:write"] },
  { key: "finance", label: "Financeiro", path: "/admin/finance", read: ["finance:read"], write: ["finance:write"] },
  { key: "budget", label: "Orçamento", path: "/admin/budget", read: ["budget:read"], write: ["budget:write"] },
  { key: "notifications", label: "Notificações", path: "/admin/notifications", read: ["notifications:read"], write: ["notifications:write"] },
  { key: "youtube", label: "Vídeos YouTube", path: "/admin/youtube-videos", read: ["youtube:read"], write: ["youtube:write"] },
  { key: "reports", label: "Relatórios", path: "/admin/reports", read: ["reports:view"], write: [] },
  { key: "settings", label: "Configurações", path: "/admin/settings", read: ["settings:read"], write: ["settings:manage"] },
  { key: "projection", label: "Tela de projeção", path: "/projecao", read: ["kids:projection:view", "parking:projection:view"], write: [] },
] as const;
export const MOBILE_MODULES = [
  { key: "kidsProjection", label: "Projetar avisos Kids (exige vínculo no ministério)", permissions: [] },
  { key: "parking", label: "Projetar avisos Estacionamento (exige vínculo no ministério)", permissions: [] },
  { key: "home", label: "Página inicial", permissions: ["dashboard:view", "youtube:read", "courses:read"] },
  { key: "agenda", label: "Minha agenda", permissions: ["calendar:read"] },
  { key: "schedules", label: "Escalas", permissions: ["schedules:read", "schedules:confirm", "schedules:substitution:request"] },
  { key: "services", label: "Cultos Fixos", permissions: ["events:read"] },
  { key: "events", label: "Eventos", permissions: ["events:read"] },
  { key: "cells", label: "Células", permissions: ["cells:read"] },
  { key: "discipleships", label: "Discipulado", permissions: ["discipleship:my:read", "discipleship:my:write"] },
  { key: "projects", label: "Projetos", permissions: ["projects:read"] },
  { key: "prayer", label: "Oração", permissions: ["prayer:read", "prayer:write"] },
  { key: "kids", label: "Infantil (meus filhos)", permissions: ["kids:checkin:self"] },
  { key: "notifications", label: "Notificações", permissions: ["notifications:read"] },
  { key: "ministries", label: "Meus ministérios", permissions: ["ministries:read"] },
  { key: "qr", label: "Leitor de QR Code", permissions: [] },
] as const;
export type WebModule = typeof WEB_MODULES[number]["key"];
export type MobileModule = typeof MOBILE_MODULES[number]["key"];
export type AccessProfile = { webEnabled: boolean; web: Partial<Record<WebModule, "read" | "write">>; mobile: MobileModule[]; agendaScope: "own" | "all" };
export type AccessConfig = { version: 1; types: Record<string, AccessProfile>; ministries: Record<string, AccessProfile>; roles: Record<string, AccessProfile> };
export type AccessIdentity = { roles: RoleKey[]; type: string | null; types?: string[]; ministries: { id: string; name: string; active: boolean }[] };
export const DEFAULT_MOBILE: MobileModule[] = ["home", "agenda", "services", "events", "cells", "discipleships", "projects", "prayer", "kids", "notifications"];
export function defaultProfile(): AccessProfile { return { webEnabled: false, web: {}, mobile: [...DEFAULT_MOBILE], agendaScope: "own" }; }
export function defaultMinistryProfile(name: string): AccessProfile {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const modules: WebModule[] = /acolher/.test(normalized) ? ["calendar", "members", "followup", "volunteers", "cells", "lostfound"] : /kids|infantil/.test(normalized) ? ["kids", "calendar", "lostfound"] : /estacionamento|parking/.test(normalized) ? ["parking", "calendar", "lostfound"] : [];
  return { webEnabled: modules.length > 0, web: Object.fromEntries(modules.map(key => [key, "write"])), mobile: /kids|infantil/.test(normalized) ? ["kidsProjection"] : /estacionamento|parking/.test(normalized) ? ["parking"] : [], agendaScope: "own" };
}
export function defaultRoleProfile(role: RoleKey): AccessProfile {
  // Operational roles get their web access from their actual ministry links.
  if (["MEMBER", "VOLUNTEER", "RECEPTION", "KIDS_MINISTRY", "PARKING"].includes(role)) return { ...defaultProfile(), mobile: [] };
  const permissions = rolePermissions[role] ?? [];
  return { webEnabled: role === "PROJECTION" || permissions.includes("admin:access"), web: Object.fromEntries(WEB_MODULES.flatMap(entry => (permissions.some(p => (entry.read as readonly string[]).includes(p)) || (entry.key === "settings" && permissions.includes("settings:manage"))) ? [[entry.key, permissions.some(p => (entry.write as readonly string[]).includes(p)) ? "write" : "read"]] : [])), mobile: [...DEFAULT_MOBILE, "schedules", "ministries", "qr"], agendaScope: "own" };
}
export function defaultAccessConfig(): AccessConfig { return { version: 1, types: Object.fromEntries(Object.keys(MEMBER_TYPES).map(key => [key, key === "VOLUNTEER" ? { ...defaultProfile(), mobile: [...DEFAULT_MOBILE, "schedules", "ministries"] } : defaultProfile()])), ministries: {}, roles: {} }; }
export function resolveAccess(identity: AccessIdentity, config: AccessConfig) {
  if (identity.roles.includes("SUPER_ADMIN")) return { webEnabled: true, webModules: WEB_MODULES.map(m => m.key), webPermissions: allPermissionKeysArray(), mobileModules: MOBILE_MODULES.map(m => m.key), mobilePermissions: allPermissionKeysArray(), agendaScope: "all" as const };
  const profile = config.types[identity.type ?? "MEMBER"] ?? defaultProfile();
  const restricted = identity.type === "VISITOR" || identity.type === "NEW_MEMBER";
  const profiles = [profile, ...(!restricted ? (identity.types ?? []).filter(type => type !== identity.type).map(type => config.types[type] ?? defaultProfile()) : []), ...(!restricted ? identity.roles.map(role => config.roles[role] ?? defaultRoleProfile(role)) : []), ...(!restricted ? identity.ministries.filter(m => m.active).map(m => config.ministries[m.id] ?? defaultMinistryProfile(m.name)) : [])];
  const webProfiles = profiles.filter(p => p.webEnabled);
  const webModules = WEB_MODULES.filter(m => webProfiles.some(p => p.web[m.key])).map(m => m.key);
  const webPermissions = new Set<PermissionKey>();
  for (const entry of WEB_MODULES) {
    const grants = webProfiles.map(p => p.web[entry.key]);
    if (grants.some(Boolean)) for (const p of entry.read) webPermissions.add(p);
    if (grants.includes("write")) for (const p of entry.write) webPermissions.add(p);
  }
  const webEnabled = webProfiles.length > 0 && webModules.length > 0;
  if (webEnabled) webPermissions.add("admin:access");
  const mobileModules = MOBILE_MODULES.filter(m => profiles.some(p => p.mobile.includes(m.key))).map(m => m.key);
  const mobilePermissions = new Set<PermissionKey>(["profile:self:edit"]);
  for (const entry of MOBILE_MODULES) if (mobileModules.includes(entry.key)) for (const permission of entry.permissions) mobilePermissions.add(permission);
  return { webEnabled, webModules, webPermissions: [...webPermissions], mobileModules, mobilePermissions: [...mobilePermissions], agendaScope: profiles.some(p => p.agendaScope === "all") ? "all" as const : "own" as const };
}

export function webModuleForPath(pathname: string) {
  return WEB_MODULES.find(m => m.path !== "/admin" && (pathname === m.path || pathname.startsWith(`${m.path}/`))) ?? (pathname === "/admin" ? WEB_MODULES.find(m => m.key === "dashboard") : undefined);
}
