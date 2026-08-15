import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}
export function hashOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function equalOAuthState(actual: string, expectedHash: string) {
  const left = Buffer.from(hashOAuthState(actual), "hex");
  const right = Buffer.from(expectedHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
export function maskMercadoPagoEmail(value: string) {
  const [local, domain] = value.split("@");
  return `${local?.slice(0, 1) ?? "*"}***@${domain ?? "invalid"}`;
}
export function mercadoPagoOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
) {
  const url = new URL("https://auth.mercadopago.local/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}
