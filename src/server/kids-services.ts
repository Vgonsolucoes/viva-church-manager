import { prisma } from "@/server/db";
import type { KidsServiceSchedule } from "@/generated/prisma/client";

// Horário oficial da igreja: a decisão do culto ativo não pode depender do
// fuso horário do servidor/container (EasyPanel roda em UTC).
export const KIDS_CHURCH_TIMEZONE = "America/Sao_Paulo";

export const KIDS_WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidServiceTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Data civil da igreja (yyyy-mm-dd) no fuso oficial, para comparações de
 * "mesmo dia" independentes do fuso do servidor/container.
 */
export function getChurchLocalDateString(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: KIDS_CHURCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function getChurchLocalParts(now: Date): { dayOfWeek: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: KIDS_CHURCH_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dayOfWeek: dayMap[weekday] ?? 0, minutes: hour * 60 + minute };
}

export type ActiveKidsServiceResult =
  | { ok: true; service: KidsServiceSchedule }
  | { ok: false; reason: "NO_ACTIVE_SERVICE" };

/**
 * Decide no backend qual culto Kids está ativo agora, considerando o dia da
 * semana, horário de início/fim e tolerância (em minutos) de cada horário.
 */
export async function getActiveKidsService(now = new Date()): Promise<ActiveKidsServiceResult> {
  const { dayOfWeek, minutes } = getChurchLocalParts(now);

  const schedules = await prisma.kidsServiceSchedule.findMany({
    where: { isActive: true, dayOfWeek },
    orderBy: { startTime: "asc" },
  });

  for (const schedule of schedules) {
    const start = timeToMinutes(schedule.startTime) - schedule.toleranceMinutes;
    const end = timeToMinutes(schedule.endTime) + schedule.toleranceMinutes;
    if (minutes >= start && minutes <= end) {
      return { ok: true, service: schedule };
    }
  }

  return { ok: false, reason: "NO_ACTIVE_SERVICE" };
}

export const NO_ACTIVE_SERVICE_MESSAGE =
  "Não existe um culto disponível para check-in neste momento.";
