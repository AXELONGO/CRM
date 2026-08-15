import { describe, expect, it } from "vitest";
import { buildAuthEmail } from "./templates";

describe("auth email templates", () => {
  it("escapes user-controlled names in HTML", () => {
    const email = buildAuthEmail({
      kind: "verification",
      recipient: "person@example.com",
      recipientName: "<script>alert(1)</script>",
      url: "http://localhost:3000/verify?token=opaque",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("<script>alert(1)</script>");
  });
});
