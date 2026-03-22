export function getUserPermissions(user: any): string[] {
  const perms = user?.permissions;
  if (Array.isArray(perms)) {
    return perms.filter((p) => typeof p === "string" && p.trim().length > 0);
  }
  return [];
}

export function hasPermission(user: any, permission: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!permission) return false;
  return getUserPermissions(user).includes(permission);
}
