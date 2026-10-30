"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/server/auth";
import { createProjectionRequest } from "@/server/projection-requests";

export async function sendParkingNotice(_previous: { ok: boolean; message: string }, form: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.uid) return { ok: false, message: "Faça login novamente." };
  const result = await createProjectionRequest(session.uid, {
    channel: "PARKING", plate: form.get("plate"), vehicle: form.get("vehicle"), color: form.get("color"), location: form.get("location"), message: form.get("message"),
  });
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/admin/parking");
  return { ok: true, message: "Aviso enviado à equipe de projeção." };
}
