import { api } from "@/services/api/client";
import { AgendaItemSchema, type AgendaItem } from "@/types";

export async function listMyAgenda(
  params?: { range?: "today" | "week" | "month" },
): Promise<AgendaItem[]> {
  const qs = new URLSearchParams();
  if (params?.range) qs.set("range", params.range);
  const query = qs.toString();
  const path = `/api/v1/agenda${query ? `?${query}` : ""}`;
  const res = await api.get<unknown>(path);
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => AgendaItemSchema.parse(item));
}
