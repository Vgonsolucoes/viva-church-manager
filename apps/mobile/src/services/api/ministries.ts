import { api } from "@/services/api/client";
import { MinistrySchema, type Ministry } from "@/types";

type MemberMinistryEntry = {
  ministry?: {
    id: string;
    name: string;
    description?: string | null;
    leaderName?: string | null;
  } | null;
  ministryId?: string;
  volunteersCount?: unknown;
};

export async function listMyMinistries(): Promise<Ministry[]> {
  return getMy();
}

export async function getMy(): Promise<Ministry[]> {
  const res = await api.get<unknown>("/api/v1/ministries/my");
  const arr = Array.isArray(res) ? res : [];
  const ministries: Ministry[] = [];
  const seen = new Set<string>();

  for (const entry of arr) {
    const mm = entry as MemberMinistryEntry;
    const m = mm.ministry;
    if (!m) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    try {
      ministries.push(
        MinistrySchema.parse({
          id: m.id,
          name: m.name,
          description:
            m.description !== undefined && m.description !== null
              ? String(m.description)
              : null,
          leaderName:
            m.leaderName !== undefined && m.leaderName !== null
              ? String(m.leaderName)
              : null,
        }),
      );
    } catch {
      // ignora entrada inválida
    }
  }

  return ministries;
}
