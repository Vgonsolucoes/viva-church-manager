import { api } from "@/services/api/client";
import { EventPublicSchema, type EventPublic } from "@/types";

export async function listPublicEvents(): Promise<EventPublic[]> {
  const res = await api.get<unknown>("/api/public/events", {
    skipAuth: true,
  });
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => EventPublicSchema.parse(item));
}
