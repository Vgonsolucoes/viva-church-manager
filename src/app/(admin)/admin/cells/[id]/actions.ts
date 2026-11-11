"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { assertWebPermission } from "@/server/access-control";
import { logAudit } from "@/server/audit";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

async function assertCellLeadership(cellId: string) {
  const session = await getServerSession(authOptions);
  if (session?.uid && session.permissions?.includes("cells:write")) return session.uid;
  if (session?.uid && session.permissions?.includes("cells:read")) {
    const cell = await prisma.cell.findFirst({
      where: { id: cellId, leader: { user: { id: session.uid } } },
      select: { id: true },
    });
    if (cell) return session.uid;
  }
  throw new Error("Você não tem permissão para gerenciar esta célula.");
}

const prayerSchema = z.object({
  requesterName: z.string().trim().min(2).max(160),
  reason: z.string().trim().min(1).max(2000),
});
const meetingSchema = z.object({
  meetingDate: z.iso.date(),
  visitorsCount: z.string().regex(/^\d{1,6}$/).transform(Number),
  presentMemberIds: z.array(z.string().min(1)),
  requesterName: z.string().trim(),
  reason: z.string().trim(),
});

function cellPath(cellId: string) {
  return `/admin/cells/${encodeURIComponent(cellId)}`;
}

function finish(cellId: string, message: string, section: string): never {
  revalidatePath("/admin/cells");
  revalidatePath(cellPath(cellId));
  redirect(`${cellPath(cellId)}?status=${message}#${section}`);
}

export async function registerCellMeeting(cellId: string, form: FormData) {
  const actorUserId = await assertCellLeadership(cellId);
  const parsed = meetingSchema.safeParse({
    ...Object.fromEntries(form),
    presentMemberIds: form.getAll("presentMemberIds"),
  });
  if (!parsed.success) finish(cellId, "invalid-meeting", "registrar-reuniao");
  const { meetingDate, visitorsCount, requesterName, reason } = parsed.data;
  const prayer = requesterName || reason ? prayerSchema.safeParse({ requesterName, reason }) : null;
  if (prayer && !prayer.success) finish(cellId, "invalid-prayer", "registrar-reuniao");
  const presentIds = [...new Set(parsed.data.presentMemberIds)];
  const meeting = await prisma.$transaction(async (tx) => {
    const eligible = await tx.member.count({
      where: {
        id: { in: presentIds },
        OR: [{ cellId }, { cellLeading: { some: { id: cellId } } }, { cellHosting: { some: { id: cellId } } }],
      },
    });
    if (eligible !== presentIds.length) return null;
    return tx.cellMeeting.create({
      data: {
        cell: { connect: { id: cellId } },
        meetingDate: new Date(`${meetingDate}T00:00:00.000Z`),
        visitorsCount,
        participantsCount: presentIds.length + visitorsCount,
        attendance: { create: presentIds.map((memberId) => ({ memberId, present: true })) },
        prayerEntries: prayer?.success ? { create: { ...prayer.data, cell: { connect: { id: cellId } } } } : undefined,
      },
    });
  });
  if (!meeting) finish(cellId, "invalid-members", "registrar-reuniao");
  await logAudit({
    actorUserId, action: "CREATE", entityType: "CellMeeting", entityId: meeting.id,
    after: { cellId, meetingDate, visitorsCount, attendanceCount: presentIds.length },
  });
  finish(cellId, "meeting-saved", "agenda");
}

export async function addCellPrayer(cellId: string, form: FormData) {
  const actorUserId = await assertCellLeadership(cellId);
  const parsed = prayerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) finish(cellId, "invalid-prayer", "oracao");
  const prayer = await prisma.cellPrayerRequest.create({ data: { ...parsed.data, cellId } });
  await logAudit({ actorUserId, action: "CREATE", entityType: "CellPrayerRequest", entityId: prayer.id, after: { cellId } });
  finish(cellId, "prayer-saved", "oracao");
}

export async function closeCellPrayer(cellId: string, prayerId: string, form: FormData) {
  const actorUserId = await assertCellLeadership(cellId);
  const reopen = form.get("reopen") === "1";
  const result = await prisma.cellPrayerRequest.updateMany({
    where: { id: prayerId, cellId, closedAt: reopen ? { not: null } : null },
    data: { closedAt: reopen ? null : new Date() },
  });
  if (result.count) {
    await logAudit({ actorUserId, action: reopen ? "REOPEN" : "CLOSE", entityType: "CellPrayerRequest", entityId: prayerId, after: { cellId } });
  }
  finish(cellId, reopen ? "prayer-reopened" : "prayer-closed", "oracao");
}

export async function deleteCell(cellId: string) {
  const { uid } = await assertWebPermission("cells:write");
  const cell = await prisma.$transaction(async (tx) => {
    await tx.member.updateMany({ where: { cellId }, data: { cellId: null, participatesInCell: false } });
    return tx.cell.delete({ where: { id: cellId }, select: { id: true, name: true } });
  });
  await logAudit({ actorUserId: uid, action: "DELETE", entityType: "Cell", entityId: cellId, before: cell });
  revalidatePath("/admin/cells");
  redirect("/admin/cells?excluida=1");
}
