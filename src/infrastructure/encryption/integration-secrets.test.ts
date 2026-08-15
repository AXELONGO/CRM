import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "./integration-secrets";

describe("integration secret encryption", () => {
  it("round trips with authenticated AAD", () => {
    const key = randomBytes(32);
    const encrypted = encryptIntegrationSecret(
      "token-value",
      "tenant/connection/token",
      { key, keyVersion: 3 },
    );
    expect(
      decryptIntegrationSecret(encrypted, "tenant/connection/token", { key }),
    ).toBe("token-value");
    expect(() => decryptIntegrationSecret(encrypted, "other", { key })).toThrow();
  });
  it("rejects tampering", () => {
    const key = randomBytes(32);
    const encrypted = encryptIntegrationSecret("token-value", "aad", { key });
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, "base64");
    tamperedCiphertext[0] ^= 1;
    expect(() =>
      decryptIntegrationSecret(
        { ...encrypted, ciphertext: tamperedCiphertext.toString("base64") },
        "aad",
        { key },
      ),
    ).toThrow();
  });
});
