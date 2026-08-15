import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

describe("safe internal redirects", () => {
  it("keeps a local path", () => {
    expect(safeInternalPath("/app?tab=home")).toBe("/app?tab=home");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/app");
    expect(safeInternalPath("//evil.example")).toBe("/app");
  });
});
