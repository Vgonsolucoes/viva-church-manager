import { api } from "@/services/api/client";
import {
  EventPublicSchema,
  EventRegistrationSchema,
  type EventPublic,
  type EventRegistration,
} from "@/types";

export async function listar(): Promise<EventPublic[]> {
  const res = await api.get<unknown>("/api/v1/events");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => EventPublicSchema.parse(item));
}

export async function listPublicEvents(): Promise<EventPublic[]> {
  const res = await api.get<unknown>("/api/public/events", { skipAuth: true });
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => EventPublicSchema.parse(item));
}

export async function listEvents(): Promise<EventPublic[]> {
  return listar();
}

export async function getEventDetail(id: string): Promise<EventPublic | null> {
  const all = await listar();
  return all.find((e) => e.id === id) ?? null;
}

export async function postRegistration(
  eventId: string,
): Promise<EventRegistration> {
  const res = await api.post<unknown>(
    `/api/v1/events/${eventId}/registrations`,
  );
  return EventRegistrationSchema.parse(res);
}
