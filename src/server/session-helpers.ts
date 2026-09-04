import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  hasPermission,
  allPermissionKeysArray,
  type PermissionKey,
  type RoleKey,
} from "@/server/rbac";
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
};

async function buildContextFromSession(
  sessionUid: string,
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
  const permissions: PermissionKey[] = [];
  for (const perm of getAllPermissionKeysCached()) {
    if (hasPermission(roles, perm)) permissions.push(perm);
  }
  return { user, roles, member, volunteerProfile, permissions };
}

let _permCache: PermissionKey[] | null = null;
function getAllPermissionKeysCached(): PermissionKey[] {
  if (_permCache) return _permCache;
  _permCache = allPermissionKeysArray();
  return _permCache as PermissionKey[];
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
  const ctx = await buildContextFromSession(session.uid);
  if (!ctx) {
    return {
      ok: false,
      error: NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 }),
    };
  }
  return { ok: true, ctx };
}

export function requirePermission(
  ctx: LoggedContext,
  permission: PermissionKey,
): NextResponse | null {
  if (!hasPermission(ctx.roles, permission)) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  return null;
}
