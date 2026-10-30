import { prisma } from "@/server/db";
import { getActiveKidsService } from "@/server/kids-services";
import { closeEndedKidsSessions } from "@/server/kids-close";
import { sendKidsProjectionMessage } from "@/server/kids-projection";
import { getProjectionAccess } from "@/server/projection-access";
import { projectionRequestSchema } from "@/lib/projection";
import { logAudit } from "@/server/audit";

export async function eligibleProjectionChildren() {
  await closeEndedKidsSessions();
  const active = await getActiveKidsService();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const today = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00-03:00`);
  const rows = await prisma.childCheckIn.findMany({
    where: { status: "CHECKED_IN", ...(active.ok ? { serviceScheduleId: active.service.id } : { checkInAt: { gte: today } }) },
    select: { child: { select: { id: true, fullName: true } } }, orderBy: { checkInAt: "asc" },
  });
  return Array.from(new Map(rows.map(row => [row.child.id, row.child])).values());
}

export async function createProjectionRequest(userId: string, input: unknown) {
  const parsed = projectionRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;
  const access = await getProjectionAccess(userId);
  if (!access[data.channel]) return { ok: false as const, status: 403, error: "Envio permitido somente à equipe do respectivo ministério." };
  if (data.channel === "KIDS") {
    const children = await eligibleProjectionChildren();
    if (!children.some(child => child.id === data.childId)) return { ok: false as const, status: 400, error: "A criança não possui check-in ativo neste culto." };
    const created = await sendKidsProjectionMessage({ childId: data.childId, message: data.message, sentById: userId });
    await logAudit({ actorUserId: userId, action: "PROJECTION_MESSAGE_SENT", entityType: "KidsProjectionMessage", entityId: created.id, after: data });
    return { ok: true as const, id: created.id };
  }
  const created = await prisma.parkingProjectionMessage.create({ data: {
    plate: data.plate, vehicle: data.vehicle || null, color: data.color || null,
    location: data.location, message: data.message, sentById: userId,
  } });
  await logAudit({ actorUserId: userId, action: "PROJECTION_MESSAGE_SENT", entityType: "ParkingProjectionMessage", entityId: created.id, after: data });
  return { ok: true as const, id: created.id };
}
