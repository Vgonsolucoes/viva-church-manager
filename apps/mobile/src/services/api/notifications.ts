import { api } from "@/services/api/client";

export async function listar(): Promise<unknown[]> {
  const res = await api.get<unknown>("/api/notifications");
  if (Array.isArray(res)) return res;
  const deliveries = (res as { deliveries?: Array<{ id: string; readAt: string | null; notification: { title: string; body: string; createdAt: string } }> })?.deliveries ?? [];
  return deliveries.map(d => ({ id: d.id, title: d.notification.title, message: d.notification.body, createdAt: d.notification.createdAt, read: Boolean(d.readAt), type: "GENERAL" }));
}
