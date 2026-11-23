"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertWebPermission } from "@/server/access-control";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { ARRIVAL_CONFIG_KEY, arrivalConfigSchema } from "@/lib/service-arrival";

export async function saveArrivalSettings(form: FormData) {
  const session = await assertWebPermission("settings:manage");
  const checked = arrivalConfigSchema.safeParse({
    enabled: form.get("enabled") === "on",
    address: form.get("address"),
    latitude: form.get("latitude") ? Number(form.get("latitude")) : null,
    longitude: form.get("longitude") ? Number(form.get("longitude")) : null,
    radiusMeters: Number(form.get("radiusMeters")),
    beforeMinutes: Number(form.get("beforeMinutes")),
    durationMinutes: Number(form.get("durationMinutes")),
  });
  if (!checked.success)
    redirect("/admin/direcao-culto?status=invalid-settings");
  await prisma.appSetting.upsert({
    where: { key: ARRIVAL_CONFIG_KEY },
    create: { key: ARRIVAL_CONFIG_KEY, value: JSON.stringify(checked.data) },
    update: { value: JSON.stringify(checked.data) },
  });
  await logAudit({
    actorUserId: session.uid,
    action: "UPDATE",
    entityType: "ArrivalSettings",
    entityId: ARRIVAL_CONFIG_KEY,
  });
  revalidatePath("/admin/direcao-culto");
  redirect("/admin/direcao-culto?status=settings-saved");
}

export async function toggleServiceGeo(form: FormData) {
  await assertWebPermission("service-direction:write");
  const eventId = z.string().min(1).parse(form.get("eventId"));
  await prisma.event.updateMany({
    where: { id: eventId, type: "SERVICE" },
    data: { geoCheckIn: form.get("enabled") === "on" },
  });
  revalidatePath("/admin/direcao-culto");
}

export async function confirmVolunteerArrival(form: FormData) {
  const session = await assertWebPermission("service-direction:write");
  const input = z
    .object({ eventId: z.string().min(1), memberId: z.string().min(1) })
    .parse(Object.fromEntries(form));
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { type: true },
  });
  if (event?.type !== "SERVICE") throw new Error("Culto não encontrado.");
  const assigned = await prisma.scheduleAssignment.count({
    where: {
      schedule: { eventId: input.eventId },
      volunteer: { memberId: input.memberId },
      status: { not: "DECLINED" },
    },
  });
  if (!assigned) throw new Error("A pessoa não está escalada neste culto.");
  const now = new Date();
  await prisma.servicePresence.upsert({
    where: { eventId_memberId: input },
    create: { ...input, arrivedAt: now, lastSeenAt: now, method: "STAFF" },
    update: { lastSeenAt: now, leftAt: null },
  });
  await logAudit({
    actorUserId: session.uid,
    action: "CONFIRM_ARRIVAL",
    entityType: "Event",
    entityId: input.eventId,
    after: { memberId: input.memberId },
  });
  revalidatePath("/admin/direcao-culto");
}
