import type { PermissionKey } from "@/types";

export function hasPermission(
  permissions: Array<string> | undefined | null,
  required: PermissionKey,
): boolean {
  if (!permissions) return false;
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: Array<string> | undefined | null,
  anyOf: PermissionKey[],
): boolean {
  if (!permissions) return false;
  return anyOf.some((p) => permissions.includes(p));
}
