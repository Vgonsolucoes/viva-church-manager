import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  hasPermission,
  rolePermissions,
  type PermissionKey,
  type RoleKey,
} from "@/server/rbac";
import { readSessionOrBearer } from "@/server/auth-jwt";

export const dynamic = "force-dynamic";

const MemberShape = z.object({
  id: z.string(),
  fullName: z.string(),
  photoUrl: z.string().nullable(),
  phone: z.string().nullable(),
  cpf: z.string().nullable(),
  birthDate: z.coerce.date().nullable(),
  joinedAt: z.coerce.date().nullable(),
  ministryId: z.string().nullable(),
  participatesInCell: z.boolean(),
});

const MeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  member: MemberShape.nullable(),
  ministries: z.array(z.object({ id: z.string(), name: z.string() })),
  leadingCellIds: z.array(z.string()),
  syncedAt: z.coerce.date(),
});

function allPermissionKeys(): PermissionKey[] {
  const gathered = new Set<PermissionKey>();
  (Object.keys(rolePermissions) as RoleKey[]).forEach((role: RoleKey) => {
    rolePermissions[role].forEach((p: PermissionKey) => gathered.add(p));
  });
  return Array.from(gathered);
}

export async function GET(req: Request) {
  const session = await readSessionOrBearer(req);
  if (!session || !session.uid) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: {
      roles: true,
      member: {
        include: {
          memberMinistries: { include: { ministry: true } },
          cellLeading: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const roles = user.roles.map((r) => r.role) as RoleKey[];
  const permKeys = allPermissionKeys();
  const permissions = permKeys.filter((p) => hasPermission(roles, p));

  const ministries = (user.member?.memberMinistries ?? []).map((m) => ({
    id: m.ministry.id,
    name: m.ministry.name,
  }));

  const resolvedImage = user.imageUrl ?? user.member?.photoUrl ?? null;

  const payload = MeResponseSchema.parse({
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    image: resolvedImage,
    roles,
    permissions,
    member: user.member
      ? {
          id: user.member.id,
          fullName: user.member.fullName,
          photoUrl: user.member.photoUrl ?? null,
          phone: user.member.phone ?? null,
          cpf: user.member.cpf ?? null,
          birthDate: user.member.birthDate ?? null,
          joinedAt: user.member.joinedAt ?? null,
          ministryId: user.member.ministryId ?? null,
          participatesInCell: user.member.participatesInCell,
        }
      : null,
    ministries,
    leadingCellIds: (user.member?.cellLeading ?? []).map((c) => c.id),
    syncedAt: new Date(),
  });

  return NextResponse.json(payload);
}
