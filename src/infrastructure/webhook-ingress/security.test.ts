import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "@/modules/inbox/infrastructure/providers/meta/shared";
import { WahaAdapter } from "@/modules/inbox/infrastructure/providers/waha/adapter";
import { validateIntegrationUrl } from "./ssrf-policy";

describe("webhook ingress security", () => {
  it("verifies Meta signatures over the exact raw bytes", () => {
    const body = Buffer.from('{"text":"á"}', "utf8");
    const signature = createHmac("sha256", "meta-secret").update(body).digest("hex");

    expect(verifyMetaSignature(body, `sha256=${signature}`, "meta-secret")).toBe(true);
    expect(
      verifyMetaSignature(
        Buffer.from('{"text":"á"} ', "utf8"),
        `sha256=${signature}`,
        "meta-secret",
      ),
    ).toBe(false);
    expect(verifyMetaSignature(body, null, "meta-secret")).toBe(false);
  });

  it("verifies WAHA HMAC over raw bytes and rejects truncation", async () => {
    const body = Buffer.from('{"event":"message"}', "utf8");
    const key = "waha-secret";
    const signature = createHmac("sha512", key).update(body).digest("hex");
    const adapter = new WahaAdapter();
    const connection = {
      id: "connection-1",
      channel: "whatsapp_waha" as const,
      externalIdentifiers: {},
      secrets: { hmacKey: key },
    };

    await expect(
      adapter.verifyWebhook(
        body,
        new Headers({ "x-webhook-hmac": signature }),
        connection,
      ),
    ).resolves.toEqual({ valid: true });
    await expect(
      adapter.verifyWebhook(
        body,
        new Headers({ "x-webhook-hmac": signature.slice(1) }),
        connection,
      ),
    ).resolves.toEqual({ valid: false });
  });

  it("blocks private integration destinations by default", async () => {
    await expect(validateIntegrationUrl("http://127.0.0.1:8080")).rejects.toThrow(
      "INTEGRATION_TLS_REQUIRED",
    );
  });
});
