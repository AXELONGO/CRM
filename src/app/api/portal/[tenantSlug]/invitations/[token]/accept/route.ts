import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { tenants } from "@/infrastructure/database/schema";
import { requireServerIdentity } from "@/modules/tenancy/infrastructure/server-context";
import { acceptPortalInvitation } from "@/modules/portal/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; token: string }> },
) {
  try {
    const session = await requireServerIdentity();
    const { tenantSlug, token } = await params;
    const access = await getIngressDatabase().transaction(async (tx) => {
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, tenantSlug))
        .limit(1);
      if (!tenant) throw new Error("PORTAL_TENANT_NOT_FOUND");
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenant.id}, true)`,
      );
      return acceptPortalInvitation(tx, {
        tenantId: tenant.id,
        token,
        userId: session.user.id,
      });
    });
    return NextResponse.json({ tenantId: access.tenantId, accessId: access.id });
  } catch {
    return NextResponse.json({ error: "La invitación no es válida." }, { status: 400 });
  }
}
