import { afterEach, describe, expect, it } from "vitest";
import { isPublicMutationRequestValid } from "./public-mutation";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function request(headers: HeadersInit, method = "POST") {
  process.env.APP_BASE_URL = "https://crm.example.test";
  return new Request("https://crm.example.test/api/public/test", { method, headers });
}

const validHeaders = {
  host: "crm.example.test",
  origin: "https://crm.example.test",
  "content-type": "application/json; charset=utf-8",
};

describe("public mutation request guard", () => {
  it("accepts only canonical JSON POST requests from the configured origin", () => {
    expect(isPublicMutationRequestValid(request(validHeaders))).toBe(true);
  });

  it.each([
    [
      "wrong origin",
      (headers: Headers) => headers.set("origin", "https://evil.example.test"),
    ],
    ["wrong host", (headers: Headers) => headers.set("host", "evil.example.test")],
    ["missing origin", (headers: Headers) => headers.delete("origin")],
    ["missing host", (headers: Headers) => headers.delete("host")],
    [
      "wrong content type",
      (headers: Headers) => headers.set("content-type", "text/plain"),
    ],
  ])("rejects %s", (_name, mutate) => {
    const headers = new Headers(validHeaders);
    mutate(headers);
    expect(isPublicMutationRequestValid(request(headers))).toBe(false);
  });

  it("rejects non-POST methods", () => {
    expect(isPublicMutationRequestValid(request(validHeaders, "GET"))).toBe(false);
  });
});
