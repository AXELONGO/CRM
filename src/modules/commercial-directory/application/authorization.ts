import { getDatabase } from "@/infrastructure/database/client";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { resolveTenantContext } from "@/modules/tenancy/infrastructure/repositories";
import { requirePermission, type Permission } from "@/modules/tenancy/domain/policy";

export async function getCommercialAuthorization(
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

export function authorizationError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return 401;
  if (error instanceof Error && error.name === "CommercialConflictError") return 409;
  if (error instanceof Error && error.name === "CommercialNotFoundError") return 404;
  if (error instanceof Error && error.name === "AuthorizationDeniedError") return 403;
  if (error instanceof Error && error.message === "FORBIDDEN") return 404;
  if (error instanceof Error && error.message === "OWNER_INVALID") return 400;
  return 400;
}
