import type { TenantRole } from "./policy";

export function requiresPrivilegedMfa(
  roles: readonly TenantRole[],
  isPlatformAdministrator: boolean,
): boolean {
  return (
    isPlatformAdministrator ||
    roles.some((role) => role === "tenant_admin" || role === "finance")
  );
}
