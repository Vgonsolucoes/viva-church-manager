import { api } from "@/services/api/client";
import {
  CellPublicSchema,
  CellDetailSchema,
  CellMeetingSchema,
  type CellPublic,
  type CellDetail,
  type CellMeeting,
} from "@/types";

export async function listPublicCells(): Promise<CellPublic[]> {
  const res = await api.get<unknown>("/api/public/cells", {
    skipAuth: true,
  });
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => CellPublicSchema.parse(item));
}

export async function getMyCell(): Promise<CellDetail | null> {
  const res = await api.get<unknown>("/api/v1/cells/my");
  const arr = Array.isArray(res) ? res : [];
  if (arr.length === 0) return null;
  const raw = arr[0] as Record<string, unknown>;
  const nextMeetingDate =
    raw.nextMeetingAt !== undefined && raw.nextMeetingAt !== null
      ? new Date(String(raw.nextMeetingAt))
      : null;
  const membersCount =
    raw.members && Array.isArray(raw.members) ? (raw.members as unknown[]).length : 0;
  const mapped: CellDetail = {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    weekday: typeof raw.weekday === "number" ? raw.weekday : 0,
    time: String(raw.time ?? ""),
    address:
      raw.address !== undefined && raw.address !== null
        ? String(raw.address)
        : null,
    neighborhood: null,
    city: null,
    state: null,
    latitude: null,
    longitude: null,
    leaderId:
      raw.leader && typeof raw.leader === "object" && raw.leader !== null
        ? String((raw.leader as Record<string, unknown>).id ?? "")
        : "",
    leaderName:
      raw.leader && typeof raw.leader === "object" && raw.leader !== null
        ? String((raw.leader as Record<string, unknown>).name ?? "")
        : "",
    leaderPhone: null,
    nextMeetingDate,
    membersCount,
  };
  return CellDetailSchema.parse(mapped);
}

export async function getCellMeetings(
  cellId: string,
): Promise<CellMeeting[]> {
  const res = await api.get<unknown>(`/api/v1/cells/${cellId}/meetings`);
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => CellMeetingSchema.parse(item));
}

type AttendanceEntry = {
  memberId: string;
  present: boolean;
};

export async function postAttendance(
  cellMeetingId: string,
  attendances: AttendanceEntry[],
  visitorsCount?: number,
): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = {
    attendances: attendances.map((a) => ({
      memberId: a.memberId,
      present: a.present,
    })),
  };
  if (visitorsCount !== undefined) {
    body.visitorsCount = visitorsCount;
  }
  const res = await api.post<unknown>(
    `/api/v1/cell-meetings/${cellMeetingId}/attendance`,
    body,
  );
  if (res && typeof res === "object" && "ok" in res) {
    return res as { ok: boolean };
  }
  return { ok: true };
}
