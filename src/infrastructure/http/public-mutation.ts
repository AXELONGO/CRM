import { getEnvironment } from "@/infrastructure/config/env";

export function isPublicMutationRequestValid(request: Request): boolean {
  const appBaseUrl = getEnvironment().APP_BASE_URL;
  const allowedOrigin = new URL(appBaseUrl).origin;
  const allowedHost = new URL(appBaseUrl).host;
  if (request.method !== "POST") return false;
  const host = request.headers.get("host");
  if (host !== allowedHost) return false;
  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) return false;
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType?.toLowerCase() !== "application/json") return false;
  return true;
}
