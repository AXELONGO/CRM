import { describe, expect, it } from "vitest";
import { createPublicToken, hashPublicToken } from "./public-token";

describe("public quote tokens", () => {
  it("stores only a one-way hash", () => {
    const value = createPublicToken();
    expect(value.token).not.toBe(value.hash);
    expect(hashPublicToken(value.token)).toBe(value.hash);
    expect(value.token.length).toBeGreaterThan(40);
  });

  it("does not reuse tokens between generations", () => {
    const first = createPublicToken();
    const second = createPublicToken();
    expect(first.token).not.toBe(second.token);
    expect(first.hash).not.toBe(second.hash);
  });
});
