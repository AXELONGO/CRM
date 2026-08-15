import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Canonical } from "./canonical";

describe("agreement canonical evidence", () => {
  it("is independent of object key insertion order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(sha256Canonical({ b: 2, a: 1 })).toBe(sha256Canonical({ a: 1, b: 2 }));
  });
});
