import type { TenantAuthorizationContext } from "@/modules/tenancy/domain/policy";

export type TenantContext = TenantAuthorizationContext & {
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
};
