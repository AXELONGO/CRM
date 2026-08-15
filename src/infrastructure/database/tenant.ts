import { sql } from "drizzle-orm";
import type { TenantContext } from "@/modules/tenancy/application/ports/tenant-context";
import type { Database } from "@/infrastructure/database/client";

export type TenantTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function withTenantIdDatabase<T>(
  db: Database,
  tenantId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error("TENANT_CONTEXT_REQUIRED");
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return operation(tx);
  });
}

export async function withUserDatabase<T>(
  db: Database,
  userId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!userId) {
    throw new Error("USER_CONTEXT_REQUIRED");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return operation(tx);
  });
}

export async function withTenantDatabase<T>(
  db: Database,
  context: TenantContext,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  return withTenantIdDatabase(db, context.tenant.id, operation);
}
