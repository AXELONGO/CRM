import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  createPublicOtp,
  hashPublicOtp,
  shouldExposeOtpCodeForTest,
  verifyPublicOtp,
} from "@/infrastructure/security/public-otp";

export function createOpaqueToken(bytes = 32) {
  const token = randomBytes(bytes).toString("base64url");
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createCsrfToken() {
  return createOpaqueToken(32);
}

export function createOtp(secret?: string): { code?: string; hash: string } {
  const otp = createPublicOtp("agreement", process.env, secret);
  return shouldExposeOtpCodeForTest() ? otp : { hash: otp.hash };
}

export function createOtpForDelivery(secret?: string): { code: string; hash: string } {
  return createPublicOtp("agreement", process.env, secret);
}

export function hashOtp(code: string, secret?: string): string {
  return hashPublicOtp("agreement", code, process.env, secret);
}

export function verifyOtp(code: string, expectedHash: string, secret: string) {
  return verifyPublicOtp("agreement", code, expectedHash, process.env, secret);
}

export function hmacEvidence(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
