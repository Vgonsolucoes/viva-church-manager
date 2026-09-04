import { api } from "@/services/api/client";
import { MeSchema, type Me } from "@/types";

export async function getMe(): Promise<Me> {
  const res = await api.get<unknown>("/api/v1/me");
  return MeSchema.parse(res);
}
