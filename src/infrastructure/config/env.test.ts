import { describe, expect, it } from "vitest";
import { getEnvironment, requireDatabaseUrl } from "./env";

describe("environment configuration", () => {
  it("uses safe public defaults without requiring production secrets", () => {
    expect(getEnvironment({ NODE_ENV: "test" })).toMatchObject({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_NAME: "CRM",
    });
  });

  it("rejects an invalid database URL when it is provided", () => {
    expect(() => getEnvironment({ DATABASE_URL: "not-a-url" })).toThrow(
      "Configuracion invalida",
    );
  });

  it("fails only when a database-dependent function is called", () => {
    expect(() => requireDatabaseUrl({})).toThrow("DATABASE_URL es obligatoria");
  });

  it("parses local auth and SMTP settings without exposing defaults as secrets", () => {
    expect(
      getEnvironment({
        AUTH_BOOTSTRAP_ENABLED: "true",
        SMTP_PORT: "1025",
        SMTP_SECURE: "false",
      }),
    ).toMatchObject({
      AUTH_BOOTSTRAP_ENABLED: true,
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
    });
  });
});
