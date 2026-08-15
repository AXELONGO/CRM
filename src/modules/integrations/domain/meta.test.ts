import { describe, expect, it } from "vitest";
import {
  assertLiveMetaCallsAllowed,
  buildMetaWebhookUrl,
  verifyMetaWebhookSignature,
} from "./meta";
import { createHmac } from "node:crypto";

describe("Meta integration security", () => {
  it("verifies raw signatures and rejects mutation", () => {
    const raw = Buffer.from('{"entry":[]}');
    const signature = `sha256=${createHmac("sha256", "fake-app-secret").update(raw).digest("hex")}`;
    expect(verifyMetaWebhookSignature(raw, signature, "fake-app-secret")).toBe(true);
    expect(
      verifyMetaWebhookSignature(
        Buffer.from('{"entry":[1]}'),
        signature,
        "fake-app-secret",
      ),
    ).toBe(false);
  });
  it("blocks real Meta while live mode is disabled", () => {
    expect(() =>
      assertLiveMetaCallsAllowed(false, "https://graph.facebook.com"),
    ).toThrow("META_LIVE_CALLS_DISABLED");
    expect(buildMetaWebhookUrl("http://localhost:3000", "key_fake")).toContain(
      "/api/webhooks/meta/whatsapp/key_fake",
    );
  });
});
