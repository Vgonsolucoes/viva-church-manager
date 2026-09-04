import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export interface AddToCalendarInput {
  title: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  location?: string | null;
  notes?: string | null;
  allDay?: boolean;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function ensureCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === "granted") return true;
    if (Platform.OS === "ios") {
      const write = await Calendar.requestCalendarPermissionsAsync();
      return write.status === "granted";
    }
    return false;
  } catch {
    return false;
  }
}

async function getDefaultCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === "ios") {
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const defaultCal = calendars.find(
        (c) => c.allowsModifications && c.isPrimary,
      ) || calendars.find((c) => c.allowsModifications);
      return defaultCal?.id ?? calendars[0]?.id ?? null;
    }
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    const defaultCal = calendars.find((c) => c.isPrimary) || calendars[0];
    return defaultCal?.id ?? null;
  } catch {
    return null;
  }
}

export async function addToCalendar(
  input: AddToCalendarInput,
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const granted = await ensureCalendarPermissions();
    if (!granted) {
      return { ok: false, error: "Permissão de calendário negada" };
    }
    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      return { ok: false, error: "Nenhum calendário disponível" };
    }
    const start = toDate(input.startDate);
    if (!start) return { ok: false, error: "Data inicial inválida" };
    let end = toDate(input.endDate);
    if (!end) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate: start,
      endDate: end,
      location: input.location ?? undefined,
      notes: input.notes ?? undefined,
      allDay: !!input.allDay,
      timeZone: "America/Sao_Paulo",
    });
    return { ok: true, eventId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao adicionar evento",
    };
  }
}
