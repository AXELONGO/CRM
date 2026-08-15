import { getDatabase } from "@/infrastructure/database/client";
import { resolveTenantContext } from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission, type Permission } from "@/modules/tenancy/domain/policy";

export async function getPaymentsAuthorization(
  request: Request,
  tenantSlug: string,
  permission: Permission,
) {
  const actor = await getRequestActor(request);
  if (!actor) throw new Error("UNAUTHENTICATED");
  const context = await resolveTenantContext(
    getDatabase(),
    actor.userId,
    tenantSlug,
    "internal",
  );
  if (!context) throw new Error("FORBIDDEN");
  requirePermission(actor, permission, context);
  return { actor, context };
}

export function paymentsAuthorizationError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") return 401;
    if (error.message === "FORBIDDEN" || error.message === "PAYMENT_PLAN_NOT_FOUND")
      return 404;
    if (error.name === "AuthorizationDeniedError") return 403;
    if (error.message.startsWith("PAYMENT_")) return 409;
  }
  return 400;
}
