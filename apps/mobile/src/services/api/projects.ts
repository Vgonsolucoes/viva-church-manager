import { api } from "@/services/api/client";
import {
  FundraisingProjectSchema,
  type FundraisingProject,
} from "@/types";

export async function listProjects(): Promise<FundraisingProject[]> {
  const res = await api.get<unknown>("/api/v1/projects");
  const arr = Array.isArray(res) ? res : [];
  return arr.map((item) => FundraisingProjectSchema.parse(item));
}
