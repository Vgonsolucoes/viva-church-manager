import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireLoggedIn, requirePermission } from "@/server/session-helpers";
import { createAuditLog } from "@/server/audit";
import type { RoleKey } from "@/server/rbac";

export const dynamic = "force-dynamic";

const PASTOR_ROLES: RoleKey[] = ["PASTOR_PRESIDENTE", "PASTOR"];
const LEADERSHIP_ROLES: RoleKey[] = [
  "PASTOR_PRESIDENTE",
  "PASTOR",
  "MINISTRY_LEADER",
  "CELL_LEADER",
  "KIDS_MINISTRY",
  "SECRETARY",
  "FINANCE",
  "SUPER_ADMIN",
  "RECEPTION",
  "PARKING",
];

function hasAnyRole(userRoles: RoleKey[], allowed: RoleKey[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}

export async function GET(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const permErr = requirePermission(ctx, "prayer:read");
  if (permErr) return permErr;

  const memberId = ctx.member?.id ?? null;
  const isPastor = hasAnyRole(ctx.roles, PASTOR_ROLES);
  const isLeadership = hasAnyRole(ctx.roles, LEADERSHIP_ROLES);

  const where: any = {
    OR: [
      { privacy: "PUBLIC" },
    ],
  };
  if (isPastor) {
    where.OR.push({ privacy: "PASTORS" });
  }
  if (isLeadership) {
    where.OR.push({ privacy: "LEADERSHIP" });
  }
  if (memberId) {
    where.OR.push({ memberId });
    where.OR.push({ privacy: "PRIVATE", memberId });
  }

  const rows = await prisma.prayerRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
  });

  const payload = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    category: r.category,
    privacy: r.privacy,
    member: {
      id: r.member.id,
      name: r.member.fullName,
      photo: r.member.photoUrl ?? null,
    },
    createdAt: r.createdAt,
  }));

  return NextResponse.json(payload);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  category: z.string().optional(),
  privacy: z.enum(["PRIVATE", "PASTORS", "LEADERSHIP", "PUBLIC"]),
});

export async function POST(req: Request) {
  const logged = await requireLoggedIn(req);
  if (!logged.ok) return logged.error;
  const { ctx } = logged;

  const permErr = requirePermission(ctx, "prayer:write");
  if (permErr) return permErr;

  if (!ctx.member?.id) {
    return NextResponse.json({ error: "MEMBER_REQUIRED" }, { status: 400 });
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await prisma.prayerRequest.create({
    data: {
      title: parsed.data.title,
      message: parsed.data.message,
      category: parsed.data.category ?? null,
      privacy: parsed.data.privacy,
      memberId: ctx.member.id,
    },
    include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
  });

  await createAuditLog({
    actorUserId: ctx.user.id,
    action: "PRAYER_CREATE",
    entityType: "PrayerRequest",
    entityId: created.id,
    after: created,
    createdById: ctx.user.id,
  });

  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      message: created.message,
      category: created.category,
      privacy: created.privacy,
      member: {
        id: created.member.id,
        name: created.member.fullName,
        photo: created.member.photoUrl ?? null,
      },
      createdAt: created.createdAt,
    },
    { status: 201 },
  );
}
