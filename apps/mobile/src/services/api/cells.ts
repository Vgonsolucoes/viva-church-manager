import { api } from "@/services/api/client";
import { CellPublicSchema, type CellPublic } from "@/types";

export async function listPublicCells(): Promise<CellPublic[]> {
  const res = await api.get<unknown>("/api/public/cells", {
    skipAuth: true,
  });
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => CellPublicSchema.parse(item));
}
