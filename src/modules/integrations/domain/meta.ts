import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  header: string | null,
  appSecret: string,
) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    createHmac("sha256", appSecret).update(rawBody).digest("hex"),
  );
  const actual = Buffer.from(header.slice(7));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function buildMetaWebhookUrl(origin: string, publicConnectionKey: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new Error("INTEGRATION_WEBHOOK_ORIGIN_INVALID");
  return `${url.toString().replace(/\/$/, "")}/api/webhooks/meta/whatsapp/${encodeURIComponent(publicConnectionKey)}`;
}

export function assertLiveMetaCallsAllowed(liveEnabled: boolean, baseUrl: string) {
  const host = new URL(baseUrl).hostname;
  if (!liveEnabled && host === "graph.facebook.com")
    throw new Error("META_LIVE_CALLS_DISABLED");
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "graph.facebook.com")
    throw new Error("META_GRAPH_HOST_NOT_ALLOWED");
}
