import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyWahaChatId,
  mapWahaStatus,
  verifyWahaHmac,
  verifyWahaTimestamp,
} from "./waha";

describe("WAHA security and normalization", () => {
  it("maps unknown states conservatively and blocks non-direct chats", () => {
    expect(mapWahaStatus("future_state")).toBe("unknown");
    expect(classifyWahaChatId("123@g.us")).toBe("group");
    expect(classifyWahaChatId("123@lid")).toBe("direct");
  });
  it("verifies sha512 over raw bytes and request freshness", () => {
    const body = Buffer.from('{"event":"message"}');
    const secret = "fake-waha-session-secret";
    const headers = new Headers({
      "x-webhook-hmac-algorithm": "sha512",
      "x-webhook-hmac": createHmac("sha512", secret).update(body).digest("hex"),
      "x-webhook-request-id": "request-1",
      "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
    });
    expect(verifyWahaHmac(body, headers, secret)).toBe(true);
    expect(verifyWahaTimestamp(headers)).toBe(true);
    expect(verifyWahaHmac(Buffer.from('{"event":"changed"}'), headers, secret)).toBe(
      false,
    );
  });
});
