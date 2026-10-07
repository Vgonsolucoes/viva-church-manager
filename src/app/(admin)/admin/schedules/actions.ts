"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";

const scheduleKindEnum = z.enum([
  "SERVICE",
  "EVENT",
  "CELL",
  "MEETING",
  "REHEARSAL",
  "OTHER",
]);

const baseScheduleSchema = z.object({
  title: z.string().min(2),
  kind: scheduleKindEnum.default("SERVICE"),
  startsAt: z.string().min(5),
  ministryId: z.string().optional().or(z.literal("")),
});

type MinistryResolution =
  | { ok: true; ministryId: string | null }
  | { ok: false; error: string };

async function resolveActiveMinistryId(
  raw: string | null | undefined,
  allowedMinistryId?: string | null,
): Promise<MinistryResolution> {
  const id = String(raw ?? "").trim();
  if (!id) return { ok: true, ministryId: null };
  if (allowedMinistryId && id === allowedMinistryId) {
    return { ok: true, ministryId: id };
  }

  const ministry = await prisma.ministry.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  if (!ministry) return { ok: false, error: "Ministério inválido ou inativo." };
  return { ok: true, ministryId: ministry.id };
}

function parseStartsAt(raw: string) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createSchedule(formData: FormData) {
  const session = await getServerSession(authOptions);
  const parsed = baseScheduleSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    startsAt: formData.get("startsAt"),
    ministryId: formData.get("ministryId"),
  });
  if (!parsed.success) return;

  const ministry = await resolveActiveMinistryId(parsed.data.ministryId);
  if (!ministry.ok) return;

  const startsAt = parseStartsAt(parsed.data.startsAt);
  if (!startsAt) return;

  const schedule = await prisma.schedule.create({
    data: {
      title: parsed.data.title.trim(),
      kind: parsed.data.kind,
      startsAt,
      ministryId: ministry.ministryId,
      createdById: session?.uid ?? null,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Schedule",
    entityId: schedule.id,
    after: {
      id: schedule.id,
      title: schedule.title,
      startsAt: schedule.startsAt,
      ministryId: schedule.ministryId,
    },
  });

  revalidatePath("/admin/schedules");
}

export type ScheduleFormState = { ok: boolean; message: string; error: string };

const updateScheduleSchema = baseScheduleSchema.extend({
  scheduleId: z.string().min(1),
});

export async function updateSchedule(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const fail = (error: string): ScheduleFormState => ({
    ok: false,
    message: "",
    error,
  });

  const session = await getServerSession(authOptions);
  if (!session?.uid) return fail("Sessão expirada. Faça login novamente.");

  const parsed = updateScheduleSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    title: formData.get("title"),
    kind: formData.get("kind"),
    startsAt: formData.get("startsAt"),
    ministryId: formData.get("ministryId"),
  });
  if (!parsed.success) {
    return fail("Dados inválidos. Verifique os campos e tente novamente.");
  }

  const startsAt = parseStartsAt(parsed.data.startsAt);
  if (!startsAt) return fail("Data e hora inválidas.");

  const before = await prisma.schedule.findUnique({
    where: { id: parsed.data.scheduleId },
    select: {
      id: true,
      title: true,
      kind: true,
      startsAt: true,
      ministryId: true,
    },
  });
  if (!before) return fail("Escala não encontrada.");

  const ministry = await resolveActiveMinistryId(
    parsed.data.ministryId,
    before.ministryId,
  );
  if (!ministry.ok) return fail(ministry.error);

  const after = await prisma.schedule.update({
    where: { id: before.id },
    data: {
      title: parsed.data.title.trim(),
      kind: parsed.data.kind,
      startsAt,
      ministryId: ministry.ministryId,
    },
    select: {
      id: true,
      title: true,
      kind: true,
      startsAt: true,
      ministryId: true,
    },
  });

  await logAudit({
    actorUserId: session.uid,
    action: "UPDATE",
    entityType: "Schedule",
    entityId: before.id,
    before,
    after,
  });

  revalidatePath("/admin/schedules");
  return { ok: true, message: "Escala atualizada com sucesso.", error: "" };
}

const addAssignmentSchema = z.object({
  scheduleId: z.string().min(1),
  volunteerId: z.string().min(1),
  roleName: z.string().min(2),
});

export async function addAssignment(formData: FormData) {
  const session = await getServerSession(authOptions);
  const parsed = addAssignmentSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    volunteerId: formData.get("volunteerId"),
    roleName: formData.get("roleName"),
  });
  if (!parsed.success) return;

  const assignment = await prisma.scheduleAssignment.create({
    data: {
      scheduleId: parsed.data.scheduleId,
      volunteerId: parsed.data.volunteerId,
      roleName: parsed.data.roleName.trim(),
      status: "PENDING",
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "ScheduleAssignment",
    entityId: assignment.id,
    after: {
      id: assignment.id,
      scheduleId: assignment.scheduleId,
      volunteerId: assignment.volunteerId,
      roleName: assignment.roleName,
    },
  });

  revalidatePath("/admin/schedules");
}
