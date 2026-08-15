import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createStripeOAuthState() {
  return randomBytes(32).toString("base64url");
}
export function hashStripeOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function equalStripeOAuthState(value: string, expectedHash: string) {
  const actual = Buffer.from(hashStripeOAuthState(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function stripeOAuthUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL("https://connect.stripe.local/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}
export function signStripeWebhook(
  raw: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
}
export function verifyStripeWebhook(
  raw: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
) {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((part) => part.split("=", 2) as [string, string]),
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1") ?? "";
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds)
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
