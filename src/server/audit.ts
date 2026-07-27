import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export async function logAudit(params: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      createdById: params.actorUserId ?? null,
    },
  });
}
