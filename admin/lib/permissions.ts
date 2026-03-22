import type { User } from "@/types/auth.types";

export function getUserPermissions(user: User | null | undefined): string[] {
  const perms = (user as any)?.permissions;
  if (Array.isArray(perms)) {
    return perms.filter((p) => typeof p === "string" && p.trim().length > 0);
  }
  return [];
}

export function hasPermission(
  user: User | null | undefined,
  permission: string,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!permission) return false;
  return getUserPermissions(user).includes(permission);
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: string[],
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return permissions.some((p) => hasPermission(user, p));
}
