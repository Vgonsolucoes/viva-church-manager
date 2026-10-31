import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  hasPermission,
  type PermissionKey,
  type RoleKey,
} from "@/server/rbac";
import { getUserAccess } from "@/server/access-control";
import { readSessionOrBearer } from "./auth-jwt";
import type { User, Member, VolunteerProfile } from "@/generated/prisma/client";

export type LoggedContext = {
  user: User & {
    roles: { role: RoleKey }[];
    member:
      | (Member & {
          memberMinistries: { ministry: { id: string; name: string } }[];
          volunteerProfile?: VolunteerProfile | null;
        })
      | null;
  };
  roles: RoleKey[];
  member: NonNullable<LoggedContext["user"]["member"]> | null;
  volunteerProfile: VolunteerProfile | null;
  permissions: PermissionKey[];
  access: NonNullable<Awaited<ReturnType<typeof getUserAccess>>>;
};

async function buildContextFromSession(
  sessionUid: string,
  mobile: boolean,
): Promise<LoggedContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUid },
    include: {
      roles: true,
      member: {
        include: {
          memberMinistries: { include: { ministry: { select: { id: true, name: true } } } },
          volunteerProfile: true,
        },
      },
    },
  });
  if (!user) return null;
  const roles = user.roles.map((r) => r.role) as RoleKey[];
  const member = user.member ?? null;
  const volunteerProfile = member?.volunteerProfile ?? null;
  const access = await getUserAccess(sessionUid);
  if (!access || (!mobile && !access.webEnabled)) return null;
  const permissions = mobile ? access.mobilePermissions : access.webPermissions;
  return { user, roles, member, volunteerProfile, permissions, access };
}

export async function requireLoggedIn(req: Request): Promise<
  | { ok: true; ctx: LoggedContext }
  | { ok: false; error: NextResponse }
> {
  const session = await readSessionOrBearer(req);
  if (!session || !session.uid) {
    return {
      ok: false,
      error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
    };
  }
  const ctx = await buildContextFromSession(session.uid, req.headers.get("authorization")?.startsWith("Bearer ") ?? false);
  if (!ctx) {
    return {
      ok: false,
      error: NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 }),
    };
  }
  const path = new URL(req.url).pathname;
  const modules = ctx.access.mobileModules;
  const mobile = req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
  const rule = path.startsWith("/api/v1/agenda") ? "agenda" : path.startsWith("/api/v1/cells") || path.startsWith("/api/v1/cell-meetings") ? "cells" : path.startsWith("/api/v1/discipleship") ? "discipleships" : path.startsWith("/api/v1/projects") ? "projects" : path.startsWith("/api/v1/ministries") ? "ministries" : path.startsWith("/api/v1/schedules") || path.startsWith("/api/v1/volunteer") ? "schedules" : path.startsWith("/api/v1/kids") && !path.includes("/projection/") ? "kids" : path === "/api/notifications" ? "notifications" : undefined;
  if (mobile && rule && !modules.includes(rule)) return { ok: false, error: NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 }) };
  if (path === "/api/v1/projection/requests") {
    const input = req.method === "GET" ? { channel: new URL(req.url).searchParams.get("channel") } : await req.clone().json().catch(() => null);
    const key = input?.channel === "PARKING" ? "parking" : "kidsProjection";
    const granted = mobile ? modules.includes(key) : ctx.access.webModules.includes(key === "parking" ? "parking" : "kids") && hasPermission(ctx.permissions, key === "parking" ? (req.method === "GET" ? "parking:read" : "parking:write") : (req.method === "GET" ? "kids:read" : "kids:write"));
    if (!granted) return { ok: false, error: NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 }) };
  }
  return { ok: true, ctx };
}

export function requirePermission(
  ctx: LoggedContext,
  permission: PermissionKey,
): NextResponse | null {
  if (!hasPermission(ctx.permissions, permission)) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  return null;
}
