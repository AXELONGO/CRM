import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getEnvironment } from "@/infrastructure/config/env";

const algorithm = "aes-256-gcm";
const keyBytes = 32;

function masterKey(value = getEnvironment().INTEGRATION_ENCRYPTION_KEY) {
  if (!value) throw new Error("INTEGRATION_ENCRYPTION_KEY_REQUIRED");
  const key = Buffer.from(value, "base64");
  if (key.length !== keyBytes) throw new Error("INTEGRATION_ENCRYPTION_KEY_INVALID");
  return key;
}

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  authenticationTag: string;
  keyVersion: number;
  algorithm: typeof algorithm;
  fingerprint: string;
};

export function fingerprintSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

export function encryptIntegrationSecret(
  value: string,
  aad: string,
  options?: { key?: Buffer; keyVersion?: number },
): EncryptedSecret {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(algorithm, options?.key ?? masterKey(), nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
    keyVersion:
      options?.keyVersion ?? getEnvironment().INTEGRATION_ENCRYPTION_KEY_VERSION,
    algorithm,
    fingerprint: fingerprintSecret(value),
  };
}

export function decryptIntegrationSecret(
  secret: EncryptedSecret,
  aad: string,
  options?: { key?: Buffer },
): string {
  if (secret.algorithm !== algorithm)
    throw new Error("INTEGRATION_SECRET_ALGORITHM_UNSUPPORTED");
  const decipher = createDecipheriv(
    algorithm,
    options?.key ?? masterKey(),
    Buffer.from(secret.nonce, "base64"),
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(secret.authenticationTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function equalFingerprint(actual: string, expected: string): boolean {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
