import { api } from "@/services/api/client";
import {
  ChildSchema,
  ChildCheckInSchema,
  type Child,
  type ChildCheckIn,
} from "@/types";

export async function getMyChildren(): Promise<Child[]> {
  const res = await api.get<unknown>("/api/v1/kids/my-children");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => ChildSchema.parse(item));
}

export async function postCheckIn(
  childId: string,
): Promise<ChildCheckIn> {
  const res = await api.post<unknown>(
    `/api/v1/kids/check-ins/${childId}/check-in`,
  );
  return ChildCheckInSchema.parse(res);
}

export async function postCheckOut(
  checkInId: string,
  pickupCode?: string,
): Promise<ChildCheckIn> {
  const body = pickupCode !== undefined ? { pickupCode } : undefined;
  const res = await api.post<unknown>(
    `/api/v1/kids/check-ins/${checkInId}/check-out`,
    body,
  );
  return ChildCheckInSchema.parse(res);
}
