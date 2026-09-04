import { api } from "@/services/api/client";

export async function listar(): Promise<unknown[]> {
  const res = await api.get<unknown>("/api/notifications");
  return Array.isArray(res) ? res : [];
}
