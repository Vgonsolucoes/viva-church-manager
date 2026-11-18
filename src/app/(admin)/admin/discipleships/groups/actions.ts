"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { churchDateTime } from "@/lib/weekly-services";
import { monthlySession, monthSchema } from "@/server/discipleship-monthly";

function finish(month: string, status: string, leaderId: string): never {
  revalidatePath("/admin/discipleships");
  revalidatePath("/admin/discipleships/groups");
  redirect(`/admin/discipleships/groups?month=${encodeURIComponent(month)}&leader=${encodeURIComponent(leaderId)}&status=${status}`);
}

export async function uploadMonthlyMaterial(form: FormData) {
  const { session, context } = await monthlySession(String(form.get("leader") ?? ""));
  if (!context?.canUpload) throw new Error("Somente o discipulador do topo desta rede pode publicar o material.");
  const month = monthSchema.parse(form.get("month"));
  const title = z.string().trim().min(1).max(160).safeParse(form.get("title"));
  const file = form.get("pdf");
  if (!title.success || !(file instanceof File) || file.size < 5 || file.size > 8 * 1024 * 1024) finish(month, "invalid-pdf", context.leaderId);
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString() !== "%PDF-") finish(month, "invalid-pdf", context.leaderId);
  const material = await prisma.discipleshipMaterial.upsert({
    where: { rootMemberId_month: { rootMemberId: context.rootId, month } },
    create: { rootMemberId: context.rootId, month, title: title.data, filename: file.name.slice(0, 200), data },
    update: { title: title.data, filename: file.name.slice(0, 200), data },
    select: { id: true },
  });
  await logAudit({ actorUserId: session.uid, action: "UPLOAD", entityType: "DiscipleshipMaterial", entityId: material.id, after: { rootMemberId: context.rootId, month } });
  finish(month, "material-saved", context.leaderId);
}

const groupSchema = z.object({
  month: monthSchema,
  date: z.iso.date(),
  notes: z.string().trim().max(3000),
  bondIds: z.array(z.string().min(1)).min(1),
  present: z.array(z.string()),
}).refine((data) => data.date.startsWith(data.month + "-"));

export async function saveGroupMeeting(form: FormData) {
  const { session, context, isSuperAdmin } = await monthlySession(String(form.get("leader") ?? ""));
  if (!context || (!isSuperAdmin && !session.permissions?.some((p) => ["discipleship:my:write", "discipleships:write"].includes(p)))) {
    throw new Error("Você não tem permissão para registrar este encontro.");
  }
  const parsed = groupSchema.safeParse({
    month: form.get("month"), date: form.get("date"), notes: form.get("notes"),
    bondIds: form.getAll("bondIds"), present: form.getAll("present"),
  });
  const month = monthSchema.parse(form.get("month"));
  if (!parsed.success) finish(month, "invalid-meeting", context.leaderId);
  const data = { ...parsed.data, present: [...new Set(parsed.data.present)] };
  const uniqueIds = [...new Set(data.bondIds)];
  if (uniqueIds.length !== data.bondIds.length || data.present.some((id) => !uniqueIds.includes(id))) finish(month, "roster-changed", context.leaderId);
  const where = { leaderId: context.leaderId, month };
  let savedId = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      savedId = await prisma.$transaction(async (tx) => {
        const group = await tx.discipleshipGroupMeeting.upsert({
          where: { leaderId_month: where },
          create: { ...where, meetingAt: churchDateTime(data.date, "12:00"), notes: data.notes || null },
          update: { meetingAt: churchDateTime(data.date, "12:00"), notes: data.notes || null },
          include: { meetings: true },
        });
        const current = await tx.discipleship.findMany({
          where: { status: "ACTIVE", OR: [{ disciplerId: context.leaderId }, { coDisciplerId: context.leaderId }] },
          select: { id: true },
        });
        const roster = group.meetings.length ? group.meetings.map((m) => m.discipleshipId) : current.map((bond) => bond.id);
        if (roster.length !== uniqueIds.length || !roster.every((id) => uniqueIds.includes(id))) throw new Error("ROSTER_CHANGED");
        for (const discipleshipId of roster) {
          const before = group.meetings.find((meeting) => meeting.discipleshipId === discipleshipId);
          await tx.discipleshipMeeting.upsert({
            where: { groupMeetingId_discipleshipId: { groupMeetingId: group.id, discipleshipId } },
            create: {
              groupMeetingId: group.id, discipleshipId, meetingAt: group.meetingAt,
              status: "COMPLETED", attendance: data.present.includes(discipleshipId),
              theme: `Encontro em Grupo · ${month}`, notes: data.notes || null, createdById: session.uid,
            },
            update: { meetingAt: group.meetingAt, attendance: data.present.includes(discipleshipId), notes: data.notes || null },
          });
          if (!before) {
            await tx.discipleship.update({ where: { id: discipleshipId }, data: { meetingsDone: { increment: 1 } } });
            await tx.discipleshipHistory.create({
              data: { discipleshipId, memberId: (await tx.discipleship.findUniqueOrThrow({ where: { id: discipleshipId }, select: { discipleId: true } })).discipleId,
                action: "MEETING_RECORDED", note: `Encontro em Grupo · ${month}`, createdById: session.uid },
            });
          }
        }
        return group.id;
      }, { isolationLevel: "Serializable", timeout: 20000 });
      break;
    } catch (error) {
      if (error instanceof Error && error.message === "ROSTER_CHANGED") finish(month, "roster-changed", context.leaderId);
      if (error && typeof error === "object" && "code" in error
        && (error.code === "P2034" || error.code === "P2002") && attempt < 2) continue;
      throw error;
    }
  }
  await logAudit({ actorUserId: session.uid, action: "SAVE", entityType: "DiscipleshipGroupMeeting", entityId: savedId, after: { ...where, present: data.present.length, absent: uniqueIds.length - data.present.length } });
  finish(month, "meeting-saved", context.leaderId);
}
