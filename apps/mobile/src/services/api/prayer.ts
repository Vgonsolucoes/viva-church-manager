import { api } from "@/services/api/client";
import {
  PrayerRequestSchema,
  type PrayerRequest,
  type PrayerRequestPrivacy,
} from "@/types";

export async function listPrayerRequests(): Promise<PrayerRequest[]> {
  const res = await api.get<unknown>("/api/v1/prayer-requests");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => PrayerRequestSchema.parse(item));
}

export async function createPrayerRequest(payload: {
  title: string;
  message: string;
  category?: string | null;
  privacy: PrayerRequestPrivacy;
}): Promise<PrayerRequest> {
  const res = await api.post<unknown>(
    "/api/v1/prayer-requests",
    payload,
  );
  return PrayerRequestSchema.parse(res);
}
