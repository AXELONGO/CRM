import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { closeDatabase, getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { platformAdministrators, tenants } from "@/infrastructure/database/schema";
import type { TenantContext } from "@/modules/tenancy/application/ports/tenant-context";
import { provisionDefaultPipeline } from "@/modules/sales/infrastructure/repositories";

const scope =
  process.argv
    .find((argument) => argument.startsWith("--tenant-id="))
    ?.split("=", 2)[1] ?? (process.argv.includes("--all") ? "all" : null);

if (!scope) {
  throw new Error(
    "Uso explicito requerido: pnpm sales:provision-default-pipelines --tenant-id=<id> o --all",
  );
}

const db = getDatabase();
try {
  const administrators = await db
    .select({ userId: platformAdministrators.userId })
    .from(platformAdministrators)
    .limit(1);
  const actorUserId = administrators[0]?.userId;
  if (!actorUserId) throw new Error("PLATFORM_ADMIN_REQUIRED");
  const targetTenants =
    scope === "all"
      ? await db
          .select({
            id: tenants.id,
            displayName: tenants.displayName,
            slug: tenants.slug,
            status: tenants.status,
            timezone: tenants.timezone,
            locale: tenants.locale,
          })
          .from(tenants)
          .where(eq(tenants.status, "active"))
      : await db
          .select({
            id: tenants.id,
            displayName: tenants.displayName,
            slug: tenants.slug,
            status: tenants.status,
            timezone: tenants.timezone,
            locale: tenants.locale,
          })
          .from(tenants)
          .where(and(eq(tenants.id, scope), eq(tenants.status, "active")));
  if (scope !== "all" && targetTenants.length === 0)
    throw new Error("TENANT_NOT_FOUND");
  const results = [];
  for (const tenant of targetTenants) {
    const context = {
      tenant,
      membership: {
        id: "provisioning",
        userId: actorUserId,
        status: "active" as const,
      },
      tenantStatus: tenant.status,
      membershipStatus: "active" as const,
      roles: ["tenant_admin" as const],
      area: "internal" as const,
    } satisfies TenantContext;
    const result = await withTenantDatabase(db, context, (tx) =>
      provisionDefaultPipeline(tx, { tenantId: tenant.id, actorUserId }),
    );
    results.push({ tenant: tenant.slug, ...result });
  }
  console.info(JSON.stringify({ scope, processed: results.length, results }));
} finally {
  await closeDatabase();
}
