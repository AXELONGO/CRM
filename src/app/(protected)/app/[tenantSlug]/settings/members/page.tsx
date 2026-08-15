import { getDatabase } from "@/infrastructure/database/client";
import { requirePermission } from "@/modules/tenancy/domain/policy";
import {
  listTenantInvitations,
  listTenantMembers,
} from "@/modules/tenancy/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, context } = await requireServerTenant(tenantSlug, "internal");
  const actor = { userId: session.user.id, isPlatformAdministrator: false };
  requirePermission(actor, "members.view", context);
  const db = getDatabase();
  return (
    <MembersClient
      tenantSlug={tenantSlug}
      members={await listTenantMembers(db, context.tenant.id)}
      invitations={await listTenantInvitations(db, context.tenant.id)}
      canManage={context.roles.includes("tenant_admin")}
    />
  );
}
