import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export type PublicOtpPurpose = "quote" | "agreement";

type EnvironmentSource = Record<string, string | undefined>;

export type EncryptedOtpCode = {
  ciphertext: string;
  nonce: string;
  authenticationTag: string;
  keyVersion: number;
};

const hmacKeyName: Record<PublicOtpPurpose, string> = {
  quote: "QUOTE_CHALLENGE_HMAC_KEY",
  agreement: "AGREEMENT_CHALLENGE_HMAC_KEY",
};
const testHmacKey: Record<PublicOtpPurpose, string> = {
  quote: "test-quote-challenge-key-32-bytes",
  agreement: "test-agreement-challenge-key-32",
};
const encryptionAlgorithm = "aes-256-gcm";
const encryptionKeyBytes = 32;
const testEncryptionKey = Buffer.alloc(encryptionKeyBytes, 0x54);

function isTestRuntime(source: EnvironmentSource): boolean {
  return source.NODE_ENV === "test";
}

function requireMinimumLength(value: string, name: string): string {
  if (value.length < 32) throw new Error(`${name}_INVALID`);
  return value;
}

export function assertPublicOtpRuntimeSafe(
  source: EnvironmentSource = process.env,
): void {
  if (source.E2E_OTP_PRINT === "true" && !isTestRuntime(source)) {
    throw new Error("E2E_OTP_PRINT_TEST_ONLY");
  }
}

export function requirePublicOtpHmacKey(
  purpose: PublicOtpPurpose,
  source: EnvironmentSource = process.env,
  override?: string,
): string {
  assertPublicOtpRuntimeSafe(source);
  const name = hmacKeyName[purpose];
  const configured = override ?? source[name];
  if (!configured) {
    if (isTestRuntime(source)) return testHmacKey[purpose];
    throw new Error(`${name}_REQUIRED`);
  }
  return requireMinimumLength(configured, name);
}

function requireOtpDeliveryEncryptionKey(
  source: EnvironmentSource = process.env,
): Buffer {
  assertPublicOtpRuntimeSafe(source);
  const configured = source.OTP_DELIVERY_ENCRYPTION_KEY;
  if (!configured) {
    if (isTestRuntime(source)) return testEncryptionKey;
    throw new Error("OTP_DELIVERY_ENCRYPTION_KEY_REQUIRED");
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== encryptionKeyBytes) {
    throw new Error("OTP_DELIVERY_ENCRYPTION_KEY_INVALID");
  }
  return key;
}

function otpDeliveryKeyVersion(source: EnvironmentSource = process.env): number {
  const value = Number(source.OTP_DELIVERY_ENCRYPTION_KEY_VERSION ?? "1");
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("OTP_DELIVERY_ENCRYPTION_KEY_VERSION_INVALID");
  }
  return value;
}

export function hashPublicOtp(
  purpose: PublicOtpPurpose,
  code: string,
  source: EnvironmentSource = process.env,
  override?: string,
): string {
  const key = requirePublicOtpHmacKey(purpose, source, override);
  return createHmac("sha256", key).update(`${purpose}-otp:v1:${code}`).digest("hex");
}

export function createPublicOtp(
  purpose: PublicOtpPurpose,
  source: EnvironmentSource = process.env,
  override?: string,
): { code: string; hash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { code, hash: hashPublicOtp(purpose, code, source, override) };
}

export function verifyPublicOtp(
  purpose: PublicOtpPurpose,
  code: string,
  expectedHash: string,
  source: EnvironmentSource = process.env,
  override?: string,
): boolean {
  const actual = Buffer.from(hashPublicOtp(purpose, code, source, override));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptOtpDeliveryCode(
  code: string,
  aad: string,
  source: EnvironmentSource = process.env,
): EncryptedOtpCode {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    encryptionAlgorithm,
    requireOtpDeliveryEncryptionKey(source),
    nonce,
  );
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
    keyVersion: otpDeliveryKeyVersion(source),
  };
}

export function decryptOtpDeliveryCode(
  encrypted: EncryptedOtpCode,
  aad: string,
  source: EnvironmentSource = process.env,
): string {
  const decipher = createDecipheriv(
    encryptionAlgorithm,
    requireOtpDeliveryEncryptionKey(source),
    Buffer.from(encrypted.nonce, "base64"),
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(encrypted.authenticationTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function shouldExposeOtpCodeForTest(
  source: EnvironmentSource = process.env,
): boolean {
  assertPublicOtpRuntimeSafe(source);
  return isTestRuntime(source);
}

export function validatePublicOtpConfiguration(
  source: EnvironmentSource = process.env,
): void {
  assertPublicOtpRuntimeSafe(source);
  if (isTestRuntime(source)) return;
  requirePublicOtpHmacKey("quote", source);
  requirePublicOtpHmacKey("agreement", source);
  requireOtpDeliveryEncryptionKey(source);
}
