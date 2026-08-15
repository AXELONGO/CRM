import {
  authorizationError as commercialAuthorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import type { Permission } from "@/modules/tenancy/domain/policy";

export { getCommercialAuthorization };

export function salesAuthorizationError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "SALES_NOT_FOUND" ||
      error.message === "AGREEMENT_NOT_FOUND" ||
      error.message === "AGREEMENT_DRAFT_NOT_FOUND" ||
      error.message === "FORBIDDEN"
    )
      return 404;
    if (error.message === "SALES_CONFLICT") return 409;
    if (
      error.message === "OPPORTUNITY_CLOSED" ||
      error.message === "OPPORTUNITY_REOPEN_REQUIRED"
    )
      return 409;
    if (error.message.startsWith("AGREEMENT_") || error.message.startsWith("EXTERNAL_"))
      return 409;
    if (
      error.message === "SALES_OWNER_INVALID" ||
      error.message.endsWith("_INVALID") ||
      error.message.endsWith("_REQUIRED")
    )
      return 400;
  }
  return commercialAuthorizationError(error);
}

export function salesPermission(permission: Permission) {
  return permission;
}
