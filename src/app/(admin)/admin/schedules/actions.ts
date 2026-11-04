"use server";
import { assertWebPermission } from "@/server/access-control";

import { redirect } from "next/navigation";
import { staffingUrl } from "@/lib/staffing";
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
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw) ? `${raw}-03:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createSchedule(formData: FormData) {
  await assertWebPermission("schedules:write");
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
  redirect(staffingUrl(schedule.id, schedule.startsAt));
}

export type ScheduleFormState = { ok: boolean; message: string; error: string };

const updateScheduleSchema = baseScheduleSchema.extend({
  scheduleId: z.string().min(1),
});

export async function updateSchedule(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  await assertWebPermission("schedules:write");
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
  if (before.id.startsWith("staffing-")) return fail("Altere o título e a data no cadastro do culto, evento ou curso vinculado.");

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
      staffingCompletedAt: null,
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
  scheduleId: z.string().min(1), volunteerId: z.string().min(1), ministryId: z.string().min(1), roleName: z.string().trim().min(2).max(80),
});

export async function addAssignment(_prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const session = await assertWebPermission("schedules:write");
  const fail = (error: string): ScheduleFormState => ({ ok: false, message: "", error });
  const parsed = addAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Selecione o ministério, o voluntário e informe a função.");
  const { scheduleId, volunteerId, ministryId, roleName } = parsed.data;
  const [schedule, volunteer, ministry] = await Promise.all([
    prisma.schedule.findUnique({ where: { id: scheduleId } }),
    prisma.volunteerProfile.findUnique({ where: { id: volunteerId }, include: { member: { include: { memberMinistries: true } } } }),
    prisma.ministry.findFirst({ where: { id: ministryId, active: true } }),
  ]);
  if (!schedule || !volunteer || !ministry) return fail("Escala, voluntário ou ministério não encontrado.");
  const linked = volunteer.ministryId === ministryId || volunteer.member.ministryId === ministryId || volunteer.member.memberMinistries.some(link => link.ministryId === ministryId);
  if (!linked) return fail("Este voluntário não está vinculado ao ministério selecionado. Atualize o cadastro de Voluntários ou Membros.");
  try {
    const assignment = await prisma.$transaction(async tx => {
      const created = await tx.scheduleAssignment.create({ data: { scheduleId, volunteerId, ministryId, roleName, status: "PENDING" } });
      await tx.schedule.update({ where: { id: scheduleId }, data: { staffingCompletedAt: null } });
      return created;
    });
    await logAudit({ actorUserId: session.uid, action: "CREATE", entityType: "ScheduleAssignment", entityId: assignment.id, after: { scheduleId, volunteerId, ministryId, roleName } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return fail("Este voluntário já está alocado nesta função. Para trocá-lo de ministério, remova a alocação anterior.");
    throw error;
  }
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/calendar");
  return { ok: true, message: "Voluntário alocado. Aguardando confirmação no aplicativo.", error: "" };
}

export async function changeStaffingState(_prev: ScheduleFormState, form: FormData): Promise<ScheduleFormState> {
  const session = await assertWebPermission("schedules:write");
  const id = String(form.get("scheduleId") ?? "");
  const complete = form.get("intent") === "complete";
  const schedule = await prisma.schedule.findUnique({ where: { id }, include: { assignments: { include: { substitutionRequests: { where: { status: { in: ["REQUESTED", "VOLUNTEER_B_ACCEPTED"] } } } } } } });
  if (!schedule) return { ok: false, message: "", error: "Escala não encontrada." };
  if (complete && (!schedule.assignments.length || schedule.assignments.some(a => a.status === "DECLINED" || a.status === "NO_SHOW" || a.substitutionRequests.length > 0))) return { ok: false, message: "", error: "Aloque a equipe e resolva as recusas ou substituições antes de concluir a montagem." };
  await prisma.schedule.update({ where: { id }, data: { staffingCompletedAt: complete ? new Date() : null } });
  await logAudit({ actorUserId: session.uid, action: complete ? "STAFFING_COMPLETE" : "STAFFING_REOPEN", entityType: "Schedule", entityId: id });
  revalidatePath("/admin/schedules");
  return { ok: true, message: complete ? "Montagem concluída. As confirmações dos voluntários continuam sendo acompanhadas individualmente." : "Montagem reaberta.", error: "" };
}

export async function removeAssignment(form: FormData) {
  const session = await assertWebPermission("schedules:write");
  const id = String(form.get("assignmentId") ?? "");
  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id } });
  if (!assignment) return;
  await prisma.$transaction([prisma.scheduleAssignment.delete({ where: { id } }), prisma.schedule.update({ where: { id: assignment.scheduleId }, data: { staffingCompletedAt: null } })]);
  await logAudit({ actorUserId: session.uid, action: "DELETE", entityType: "ScheduleAssignment", entityId: id, before: assignment });
  revalidatePath("/admin/schedules");
}
