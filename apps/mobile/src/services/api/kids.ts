import { api } from "@/services/api/client";
import {
  ChildSchema,
  ChildCheckInSchema,
  KidsServiceInfoSchema,
  KidsCheckinResultSchema,
  type Child,
  type ChildCheckIn,
  type KidsServiceInfo,
  type KidsCheckinResult,
} from "@/types";

export type ChildPayload = {
  fullName: string;
  birthDate?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  photoUrl?: string | null;
  allergies?: string | null;
  medications?: string | null;
  specialNeeds?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
};

export async function getMyChildren(): Promise<Child[]> {
  const res = await api.get<unknown>("/api/v1/kids/my-children");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => ChildSchema.parse(item));
}

export async function createChild(payload: ChildPayload): Promise<Child> {
  const res = await api.post<unknown>("/api/v1/kids/children", payload);
  return ChildSchema.parse(res);
}

export async function updateChild(
  childId: string,
  payload: ChildPayload,
): Promise<Child> {
  const res = await api.put<unknown>(
    `/api/v1/kids/children/${childId}`,
    payload,
  );
  return ChildSchema.parse(res);
}

export async function uploadChildPhoto(localUri: string): Promise<string> {
  const form = new FormData();
  const filename = localUri.split("/").pop() ?? "child.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  form.append("photoFile", {
    uri: localUri,
    name: filename,
    type: mime,
  } as unknown as Blob);

  const res = await api.post<{ ok: boolean; url?: string; error?: string }>(
    "/api/uploads/child-photo",
    form,
  );
  if (!res?.ok || !res.url) {
    throw new Error(res?.error ?? "Falha ao enviar foto.");
  }
  return res.url;
}

export async function postCheckIn(
  childId: string,
): Promise<ChildCheckIn> {
  const res = await api.post<unknown>(
    `/api/v1/kids/check-ins/${childId}/check-in`,
  );
  return ChildCheckInSchema.parse(res);
}

export async function validateKidsCheckinQr(
  token: string,
): Promise<KidsServiceInfo> {
  const res = await api.post<unknown>("/api/v1/kids/checkin/validate", {
    token,
  });
  const parsed = KidsServiceInfoSchema.parse((res as { service: unknown }).service);
  return parsed;
}

export async function postKidsCheckin(
  token: string,
  childIds: string[],
): Promise<KidsCheckinResult> {
  const res = await api.post<unknown>("/api/v1/kids/checkin", {
    token,
    childIds,
  });
  return KidsCheckinResultSchema.parse(res);
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
