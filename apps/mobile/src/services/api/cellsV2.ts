import { api } from "@/services/api/client";
import {
  CellDetailSchema,
  type CellDetail,
} from "@/types";

export async function listMyCells(): Promise<CellDetail[]> {
  const res = await api.get<unknown>("/api/v1/cells/my");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => CellDetailSchema.parse(item));
}

type CellMemberStub = {
  id: string;
  fullName: string;
  photoUrl: string | null;
};

export async function listCellMembers(
  cellId: string,
): Promise<CellMemberStub[]> {
  const res = await api.get<unknown>(
    `/api/v1/cells/my?cellId=${encodeURIComponent(cellId)}`,
  );
  const arr = Array.isArray(res) ? res : [];
  const first = (arr as CellDetail[])[0];
  if (first && (first as any).members) {
    return (first as any).members as CellMemberStub[];
  }
  return [];
}

export async function postAttendance(
  cellMeetingId: string,
  payload: {
    presentMemberIds: string[];
    visitorsCount: number;
  },
): Promise<void> {
  await api.post(
    `/api/v1/cell-meetings/${cellMeetingId}/attendance`,
    payload,
  );
}
