import { describe, expect, it } from "vitest";
import { areRolesCompatible, can } from "./policy";

const actor = { userId: "user-1", isPlatformAdministrator: false };
const context = {
  tenantStatus: "active" as const,
  membershipStatus: "active" as const,
  area: "internal" as const,
  roles: ["sales"] as const,
};

describe("commercial directory permissions", () => {
  it("denies unknown or inactive authorization contexts by default", () => {
    expect(can(actor, "contacts.view", undefined)).toBe(false);
    expect(
      can(actor, "contacts.view", { ...context, membershipStatus: "suspended" }),
    ).toBe(false);
    expect(can(actor, "contacts.view", { ...context, tenantStatus: "suspended" })).toBe(
      false,
    );
  });

  it("keeps client roles exclusive from internal roles", () => {
    expect(areRolesCompatible(["client"])).toBe(true);
    expect(areRolesCompatible(["sales", "execution"])).toBe(true);
    expect(areRolesCompatible(["client", "sales"])).toBe(false);
    expect(areRolesCompatible([])).toBe(false);
  });

  it("allows sales to manage contacts but not global tags", () => {
    expect(can(actor, "contacts.create", context)).toBe(true);
    expect(can(actor, "tags.manage", context)).toBe(false);
  });

  it("denies the internal directory to clients", () => {
    expect(can(actor, "contacts.view", { ...context, roles: ["client"] })).toBe(false);
  });

  it("does not grant platform administrators tenant data automatically", () => {
    expect(
      can({ ...actor, isPlatformAdministrator: true }, "contacts.view", undefined),
    ).toBe(false);
  });
});
