import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns the stable public health contract", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({ status: "ok", service: "crm" });
    expect(body.version).toBeTypeOf("string");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(body).sort()).toEqual([
      "service",
      "status",
      "timestamp",
      "version",
    ]);
  });
});
