"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import {
  KIDS_PRINT_JOB_STATUS,
  setKidsPrintConfig,
} from "@/server/kids-print";

export type KidsPrintConfigFormState = { ok: boolean; message: string; error: string };

const initialError = (error: string): KidsPrintConfigFormState => ({
  ok: false,
  message: "",
  error,
});

async function requireKidsWrite() {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  if (!session?.uid || !hasPermission(roles, "kids:write")) return null;
  return session;
}

const configSchema = z.object({
  enabled: z.enum(["on", "off"]).default("off"),
  labelWidthMm: z.coerce.number().int().min(30).max(120),
  copies: z.coerce.number().int().min(1).max(4),
});

export async function saveKidsPrintConfig(
  _prev: KidsPrintConfigFormState,
  formData: FormData,
): Promise<KidsPrintConfigFormState> {
  const session = await requireKidsWrite();
  if (!session) return initialError("Sem permissão para configurar a impressão do Kids.");

  const parsed = configSchema.safeParse({
    enabled: formData.get("enabled") === "on" ? "on" : "off",
    labelWidthMm: formData.get("labelWidthMm"),
    copies: formData.get("copies"),
  });
  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const config = {
    enabled: parsed.data.enabled === "on",
    labelWidthMm: parsed.data.labelWidthMm,
    copies: parsed.data.copies,
  };

  await setKidsPrintConfig(config);

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "UPDATE",
    entityType: "AppSetting",
    entityId: "kidsPrint",
    after: config,
  });

  revalidatePath("/admin/kids/impressao");
  return {
    ok: true,
    message: config.enabled
      ? "Impressão automática ativada."
      : "Impressão automática desativada. Novos check-ins não gerarão etiquetas.",
    error: "",
  };
}

/** Reenvia uma etiqueta para a fila (FAILED/CANCELLED/PRINTED → PENDING). */
export async function retryKidsPrintJob(formData: FormData) {
  const session = await requireKidsWrite();
  if (!session) return;

  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const before = await prisma.kidsPrintJob.findUnique({ where: { id: jobId } });
  if (!before || before.status === KIDS_PRINT_JOB_STATUS.PENDING) return;

  await prisma.kidsPrintJob.update({
    where: { id: jobId },
    data: { status: KIDS_PRINT_JOB_STATUS.PENDING, error: null },
  });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "UPDATE",
    entityType: "KidsPrintJob",
    entityId: jobId,
    before: { status: before.status },
    after: { status: KIDS_PRINT_JOB_STATUS.PENDING },
  });

  revalidatePath("/admin/kids/impressao");
}

/** Cancela uma etiqueta pendente (não será impressa). */
export async function cancelKidsPrintJob(formData: FormData) {
  const session = await requireKidsWrite();
  if (!session) return;

  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const before = await prisma.kidsPrintJob.findUnique({ where: { id: jobId } });
  if (!before || before.status !== KIDS_PRINT_JOB_STATUS.PENDING) return;

  await prisma.kidsPrintJob.update({
    where: { id: jobId },
    data: { status: KIDS_PRINT_JOB_STATUS.CANCELLED },
  });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "UPDATE",
    entityType: "KidsPrintJob",
    entityId: jobId,
    before: { status: before.status },
    after: { status: KIDS_PRINT_JOB_STATUS.CANCELLED },
  });

  revalidatePath("/admin/kids/impressao");
}
