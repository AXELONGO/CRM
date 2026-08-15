import { createHmac, timingSafeEqual } from "node:crypto";

export function maskPayPalEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 1) ?? "*"}***@${domain ?? "invalid"}`;
}
export function signPayPalWebhook(raw: string, secret: string) {
  return createHmac("sha256", secret).update(raw).digest("hex");
}
export function verifyPayPalWebhook(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = Buffer.from(signPayPalWebhook(raw, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
