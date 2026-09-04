import { api } from "@/services/api/client";
import { CellDetailSchema, type CellDetail } from "@/types";

export async function getMyCell(): Promise<CellDetail | null> {
  try {
    const res = await api.get<unknown>("/api/v1/cells/my");
    if (!res) return null;
    return CellDetailSchema.parse(res);
  } catch (e) {
    if (e instanceof Error && (e as any).status === 404) return null;
    throw e;
  }
}
