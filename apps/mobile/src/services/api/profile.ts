import { api } from "@/services/api/client";
import { ProfilePatchSchema, type ProfilePatch } from "@/types";

export async function patchProfile(
  payload: ProfilePatch,
): Promise<void> {
  const valid = ProfilePatchSchema.parse(payload);
  await api.patch("/api/v1/me/profile", valid);
}
