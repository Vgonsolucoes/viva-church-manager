"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { sendKidsProjectionMessage } from "@/server/kids-projection";
import {
  KIDS_PROJECTION_MESSAGE_MAX,
  KIDS_PROJECTION_PRESETS,
} from "@/lib/kids-projection";

export type KidsProjectionFormState = { ok: boolean; message: string; error: string };

const initialError = (error: string): KidsProjectionFormState => ({
  ok: false,
  message: "",
  error,
});

const CUSTOM_OPTION = "__custom__";

const sendSchema = z.object({
  childId: z.string().min(1),
  preset: z.string().min(1),
  customMessage: z.string().trim().max(KIDS_PROJECTION_MESSAGE_MAX).optional(),
});

export async function sendProjectionMessage(
  _prev: KidsProjectionFormState,
  formData: FormData,
): Promise<KidsProjectionFormState> {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  if (!session?.uid || !hasPermission(roles, "kids:projection:send")) {
    return initialError("Sem permissão para enviar mensagens à projeção.");
  }

  const parsed = sendSchema.safeParse({
    childId: formData.get("childId"),
    preset: formData.get("preset"),
    customMessage: formData.get("customMessage") ?? undefined,
  });
  if (!parsed.success) return initialError("Dados inválidos.");

  let message: string;
  if (parsed.data.preset === CUSTOM_OPTION) {
    const custom = parsed.data.customMessage?.trim() ?? "";
    if (custom.length < 3) {
      return initialError("Descreva a mensagem (mínimo de 3 caracteres).");
    }
    message = custom;
  } else if ((KIDS_PROJECTION_PRESETS as readonly string[]).includes(parsed.data.preset)) {
    message = parsed.data.preset;
  } else {
    return initialError("Mensagem inválida.");
  }

  const child = await prisma.child.findUnique({
    where: { id: parsed.data.childId },
    select: { id: true, fullName: true },
  });
  if (!child) return initialError("Criança não encontrada.");

  const created = await sendKidsProjectionMessage({
    childId: child.id,
    message,
    sentById: session.uid,
  });

  await logAudit({
    actorUserId: session.uid,
    action: "PROJECTION_MESSAGE_SENT",
    entityType: "KidsProjectionMessage",
    entityId: created.id,
    after: {
      childId: child.id,
      childName: child.fullName,
      message,
      serviceScheduleId: created.serviceScheduleId,
    },
  });

  revalidatePath("/admin/kids/projecao");
  return { ok: true, message: `Chamado enviado para a projeção: ${child.fullName}.`, error: "" };
}
