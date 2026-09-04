import { prisma } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";

export async function createAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  createdById?: string | null;
}) {
  const beforeJson =
    input.before === undefined || input.before === null
      ? Prisma.JsonNull
      : (JSON.parse(JSON.stringify(input.before)) as unknown);
  const afterJson =
    input.after === undefined || input.after === null
      ? Prisma.JsonNull
      : (JSON.parse(JSON.stringify(input.after)) as unknown);

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: beforeJson as any,
        after: afterJson as any,
        createdById: input.createdById ?? input.actorUserId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Falha ao gravar log", err instanceof Error ? err.message : err);
  }
}

export const logAudit = createAuditLog;
