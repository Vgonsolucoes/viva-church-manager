"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";
import { isValidServiceTime, timeToMinutes } from "@/server/kids-services";

export type KidsServiceFormState = { ok: boolean; message: string; error: string };

const initialError = (error: string): KidsServiceFormState => ({ ok: false, message: "", error });

async function requireKidsWrite() {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  if (!session?.uid || !hasPermission(roles, "kids:write")) return null;
  return session;
}

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do culto."),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().trim(),
  endTime: z.string().trim(),
  toleranceMinutes: z.coerce.number().int().min(0).max(180).default(30),
});

function validateService(input: z.infer<typeof serviceSchema>): string | null {
  if (!isValidServiceTime(input.startTime) || !isValidServiceTime(input.endTime)) {
    return "Horários devem estar no formato HH:mm.";
  }
  if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
    return "O horário de término deve ser maior que o horário de início.";
  }
  return null;
}

export async function createKidsService(
  _prev: KidsServiceFormState,
  formData: FormData,
): Promise<KidsServiceFormState> {
  const session = await requireKidsWrite();
  if (!session) return initialError("Sem permissão para gerenciar os horários dos cultos.");

  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    toleranceMinutes: formData.get("toleranceMinutes") ?? "30",
  });
  if (!parsed.success) {
    return initialError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const invalid = validateService(parsed.data);
  if (invalid) return initialError(invalid);

  const service = await prisma.kidsServiceSchedule.create({
    data: {
      name: parsed.data.name,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      toleranceMinutes: parsed.data.toleranceMinutes,
    },
  });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "CREATE",
    entityType: "KidsServiceSchedule",
    entityId: service.id,
    after: {
      id: service.id,
      name: service.name,
      dayOfWeek: service.dayOfWeek,
      startTime: service.startTime,
      endTime: service.endTime,
      toleranceMinutes: service.toleranceMinutes,
    },
  });

  revalidatePath("/admin/kids/horarios");
  return { ok: true, message: `Culto "${service.name}" cadastrado com sucesso.`, error: "" };
}

const toggleSchema = z.object({
  serviceId: z.string().min(1),
  nextActive: z.enum(["true", "false"]),
});

export async function toggleKidsServiceActive(
  _prev: KidsServiceFormState,
  formData: FormData,
): Promise<KidsServiceFormState> {
  const session = await requireKidsWrite();
  if (!session) return initialError("Sem permissão para gerenciar os horários dos cultos.");

  const parsed = toggleSchema.safeParse({
    serviceId: formData.get("serviceId"),
    nextActive: formData.get("nextActive"),
  });
  if (!parsed.success) return initialError("Dados inválidos.");

  const before = await prisma.kidsServiceSchedule.findUnique({
    where: { id: parsed.data.serviceId },
  });
  if (!before) return initialError("Culto não encontrado.");

  const isActive = parsed.data.nextActive === "true";
  const service = await prisma.kidsServiceSchedule.update({
    where: { id: before.id },
    data: { isActive },
  });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "UPDATE",
    entityType: "KidsServiceSchedule",
    entityId: service.id,
    before: { isActive: before.isActive },
    after: { isActive: service.isActive },
  });

  revalidatePath("/admin/kids/horarios");
  return {
    ok: true,
    message: isActive
      ? `Culto "${service.name}" ativado.`
      : `Culto "${service.name}" desativado.`,
    error: "",
  };
}

const deleteSchema = z.object({ serviceId: z.string().min(1) });

export async function deleteKidsService(
  _prev: KidsServiceFormState,
  formData: FormData,
): Promise<KidsServiceFormState> {
  const session = await requireKidsWrite();
  if (!session) return initialError("Sem permissão para gerenciar os horários dos cultos.");

  const parsed = deleteSchema.safeParse({ serviceId: formData.get("serviceId") });
  if (!parsed.success) return initialError("Dados inválidos.");

  const before = await prisma.kidsServiceSchedule.findUnique({
    where: { id: parsed.data.serviceId },
  });
  if (!before) return initialError("Culto não encontrado.");

  await prisma.kidsServiceSchedule.delete({ where: { id: before.id } });

  await logAudit({
    actorUserId: session.uid ?? null,
    action: "DELETE",
    entityType: "KidsServiceSchedule",
    entityId: before.id,
    before: { id: before.id, name: before.name },
  });

  revalidatePath("/admin/kids/horarios");
  return { ok: true, message: `Culto "${before.name}" removido.`, error: "" };
}
