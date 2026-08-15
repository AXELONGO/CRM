import type {
  TenantAuthorizationContext,
  TenantRole,
} from "@/modules/tenancy/domain/policy";

export type ResolvedTenantContext = TenantAuthorizationContext & {
  tenant: {
    id: string;
    displayName: string;
    slug: string;
    status: "active" | "suspended";
    timezone: string;
    locale: string;
  };
  membership: {
    id: string;
    userId: string;
    status: "active" | "suspended" | "revoked";
  };
  roles: readonly TenantRole[];
};

export interface TenantResolver {
  resolveInternal(
    userId: string,
    tenantSlug: string,
  ): Promise<ResolvedTenantContext | null>;
  resolvePortal(
    userId: string,
    tenantSlug: string,
  ): Promise<ResolvedTenantContext | null>;
}
