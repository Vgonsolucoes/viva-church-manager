import { api } from "./client";
export type ProjectionChannel = "KIDS" | "PARKING";
export type ProjectionRequests = {
  children: Array<{ id: string; fullName: string }>;
  history: Array<{ id: string; subject: string; message: string; status: string; sentAt: string }>;
};
export function getProjectionRequests(channel: ProjectionChannel) {
  return api.get<ProjectionRequests>(`/api/v1/projection/requests?channel=${channel}`);
}
export async function sendProjectionRequest(payload: { channel: ProjectionChannel; childId?: string; message: string; plate?: string; vehicle?: string; color?: string; location?: string }) {
  return api.post<{ ok: true; id: string }>("/api/v1/projection/requests", payload);
}
