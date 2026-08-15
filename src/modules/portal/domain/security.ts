import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createPortalToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function verifyPortalToken(token: string, expectedHash: string) {
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizePortalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized))
    throw new Error("PORTAL_HOST_INVALID");
  if (normalized.includes("..") || normalized === "localhost")
    throw new Error("PORTAL_HOST_INVALID");
  return normalized;
}
