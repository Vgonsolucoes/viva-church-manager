"use server";
import { assertWebPermission } from "@/server/access-control";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";


import { getProjectionAccess } from "@/server/projection-access";
import { createProjectionRequest } from "@/server/projection-requests";
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
  await assertWebPermission("kids:write");
  const session = await getServerSession(authOptions);
  if (!session?.uid || !(await getProjectionAccess(session.uid)).KIDS) {
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

  const result = await createProjectionRequest(session.uid, { channel: "KIDS", childId: parsed.data.childId, message });
  if (!result.ok) return initialError(result.error);

  revalidatePath("/admin/kids/projecao");
  return { ok: true, message: "Chamado enviado para a projeção.", error: "" };
}
