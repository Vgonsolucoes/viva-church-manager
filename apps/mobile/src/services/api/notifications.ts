import { api } from "@/services/api/client";

export async function listar(): Promise<unknown[]> {
  const res = await api.get<unknown>("/api/notifications");
  if (Array.isArray(res)) return res;
  const deliveries = (res as { deliveries?: Array<{ id: string; readAt: string | null; notification: { title: string; body: string; createdAt: string; deepLink?: string | null } }> })?.deliveries ?? [];
  return deliveries.map(({ id, readAt, notification }) => ({
    id,
    title: notification.title,
    message: notification.body,
    createdAt: notification.createdAt,
    read: Boolean(readAt),
    type: notification.deepLink?.endsWith("/escalas") ? "SCHEDULE" : "GENERAL",
  }));
}
