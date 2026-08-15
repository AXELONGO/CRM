import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const wahaSessionStates = [
  "unprovisioned",
  "stopped",
  "starting",
  "qr_required",
  "pairing_required",
  "passkey_required",
  "authenticated",
  "working",
  "degraded",
  "failed",
  "stopping",
  "logged_out",
  "revoked",
  "unknown",
] as const;
export type WahaSessionState = (typeof wahaSessionStates)[number];

export function mapWahaStatus(value: string): WahaSessionState {
  const normalized = value.trim().toUpperCase();
  if (normalized === "STOPPED") return "stopped";
  if (normalized === "STARTING") return "starting";
  if (normalized === "SCAN_QR_CODE" || normalized === "QR_REQUIRED")
    return "qr_required";
  if (normalized === "PAIRING_REQUIRED") return "pairing_required";
  if (normalized === "PASSKEY_REQUIRED") return "passkey_required";
  if (normalized === "AUTHENTICATED") return "authenticated";
  if (normalized === "WORKING") return "working";
  if (normalized === "FAILED") return "failed";
  if (normalized === "STOPPING") return "stopping";
  if (normalized === "LOGGED_OUT") return "logged_out";
  if (normalized === "REVOKED") return "revoked";
  if (normalized === "DEGRADED") return "degraded";
  return "unknown";
}

export function createOpaqueSessionName() {
  return `crm_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function hashPublicConnectionKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function fakeWahaWebhookSecret(publicConnectionKey: string) {
  return createHash("sha256")
    .update(`fake-waha-webhook:${publicConnectionKey}`, "utf8")
    .digest("hex");
}

export function verifyWahaHmac(rawBody: Buffer, headers: Headers, secret: string) {
  const algorithm = headers.get("x-webhook-hmac-algorithm");
  if (algorithm !== null && algorithm.toLowerCase() !== "sha512") return false;
  const provided = headers.get("x-webhook-hmac") ?? "";
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "ascii");
  const right = Buffer.from(provided, "ascii");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWahaTimestamp(
  headers: Headers,
  now = Date.now(),
  toleranceSeconds = 300,
) {
  const requestId = headers.get("x-webhook-request-id")?.trim();
  const rawTimestamp = headers.get("x-webhook-timestamp")?.trim();
  const timestamp = rawTimestamp ? Number(rawTimestamp) : NaN;
  const millis = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return Boolean(
    requestId &&
    Number.isFinite(timestamp) &&
    Math.abs(now - millis) <= toleranceSeconds * 1000,
  );
}

export function classifyWahaChatId(chatId: string) {
  if (chatId.endsWith("@g.us")) return "group" as const;
  if (chatId.endsWith("@newsletter")) return "channel" as const;
  if (chatId === "status@broadcast") return "status" as const;
  if (
    chatId.endsWith("@c.us") ||
    chatId.endsWith("@s.whatsapp.net") ||
    chatId.endsWith("@lid")
  )
    return "direct" as const;
  return "unsupported" as const;
}

export function wahaWebhookUrl(origin: string, publicConnectionKey: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.hostname !== "localhost")
    throw new Error("WAHA_WEBHOOK_ORIGIN_MUST_BE_HTTPS");
  return new URL(
    `/api/webhooks/waha/${encodeURIComponent(publicConnectionKey)}`,
    base,
  ).toString();
}

export function assertWahaLiveDisabled(
  source: Record<string, string | undefined> = process.env,
) {
  if (source.WAHA_LIVE_ENABLED === "true")
    throw new Error("WAHA_LIVE_DISABLED_IN_THIS_BUILD");
}
