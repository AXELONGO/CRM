import { beforeEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hashPublicToken } from "../../src/modules/quotes/domain/public-token";
import { decryptOtpDeliveryCode } from "../../src/infrastructure/security/public-otp";
import {
  requestQuoteOtp,
  verifyQuoteOtpForSession,
} from "../../src/modules/quotes/infrastructure/repositories";
import {
  ingressDb,
  migrationSql,
  resetTestDatabase,
  runtimeURL_,
  syntheticQuote,
  syntheticQuotePublicLink,
  syntheticQuotePublicSession,
  syntheticTenant,
  syntheticUser,
  withMigrationTenantTx,
  withTenantTx,
  workerURL_,
} from "./db";

const tenantId = "tenant-a";
const userId = "user-a";
const quoteId = "quote-a";
const linkId = "link-a";
const sessionId = "session-a";
const sessionToken = "session-token-a";
const sessionHash = hashPublicToken(sessionToken);
const execFileAsync = promisify(execFile);

async function seed() {
  await resetTestDatabase();
  const sql = migrationSql();
  try {
    await syntheticUser(sql, userId, "user-a@example.test");
    await syntheticTenant(sql, tenantId, userId);
  } finally {
    await sql.end({ timeout: 2 });
  }
  await syntheticQuote(tenantId, quoteId, userId);
  await syntheticQuotePublicLink(
    tenantId,
    quoteId,
    linkId,
    hashPublicToken("link-token-a"),
    userId,
  );
  await syntheticQuotePublicSession(
    tenantId,
    quoteId,
    sessionId,
    sessionHash,
    hashPublicToken("csrf-a"),
  );
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  await seed();
});

describe("repro B-03: failed OTP attempts must persist", () => {
  it("queues an encrypted OTP only for the quote's active primary email", async () => {
    const { db, close } = ingressDb();
    try {
      const requested = await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));
      if (!("testCode" in requested) || !requested.testCode) {
        throw new Error("TEST_OTP_CODE_EXPECTED");
      }
      const delivery = await withMigrationTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select recipient, code_ciphertext, code_nonce, code_authentication_tag,
                 key_version, status
          from public_otp_delivery_jobs
          where subject_id = ${requested.challengeId}
        `;
        return row as {
          recipient: string;
          code_ciphertext: string;
          code_nonce: string;
          code_authentication_tag: string;
          key_version: number;
          status: string;
        };
      });
      expect(delivery.recipient).toBe("quote-quote-a@example.test");
      expect(delivery.status).toBe("pending");
      expect(delivery.code_ciphertext).not.toContain(requested.testCode);
      expect(
        decryptOtpDeliveryCode(
          {
            ciphertext: delivery.code_ciphertext,
            nonce: delivery.code_nonce,
            authenticationTag: delivery.code_authentication_tag,
            keyVersion: Number(delivery.key_version),
          },
          `otp-delivery:quote-otp:${requested.challengeId}`,
        ),
      ).toBe(requested.testCode);
    } finally {
      await close();
    }
  });

  it("delivers queued OTPs through the worker EmailSender adapter", async () => {
    const { db, close } = ingressDb();
    try {
      const requested = await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));
      await execFileAsync(
        process.execPath,
        ["--import", "tsx", "scripts/integration-worker.ts"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: "test",
            DATABASE_URL: runtimeURL_,
            DATABASE_WORKER_URL: workerURL_,
            APP_BASE_URL: "http://localhost:3000",
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: "1025",
            INTEGRATION_WORKER_RUN_ONCE: "true",
          },
        },
      );
      const delivery = await withMigrationTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select status, delivered_at
          from public_otp_delivery_jobs
          where subject_id = ${requested.challengeId}
        `;
        return row as { status: string; delivered_at: Date | null };
      });
      expect(delivery.status).toBe("sent");
      expect(delivery.delivered_at).not.toBeNull();
    } finally {
      await close();
    }
  });

  it("enforces resend cooldown and a bounded request window", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));
      await expect(
        db.transaction((tx) => requestQuoteOtp(tx, sessionToken)),
      ).rejects.toThrow("QUOTE_OTP_COOLDOWN");

      for (let resend = 0; resend < 2; resend += 1) {
        await withTenantTx(tenantId, async (t) => {
          await t`
            update quote_public_sessions
            set otp_last_sent_at = now() - interval '61 seconds'
            where id = ${sessionId}
          `;
        });
        await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));
      }

      await withTenantTx(tenantId, async (t) => {
        await t`
          update quote_public_sessions
          set otp_last_sent_at = now() - interval '61 seconds'
          where id = ${sessionId}
        `;
      });
      await expect(
        db.transaction((tx) => requestQuoteOtp(tx, sessionToken)),
      ).rejects.toThrow("QUOTE_OTP_RATE_LIMITED");
    } finally {
      await close();
    }
  });

  it("keeps the attempt counter after a wrong code (no rollback loss)", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));

      try {
        await db.transaction((tx) =>
          verifyQuoteOtpForSession(tx, sessionToken, "000000"),
        );
      } catch {
        // expected: the code is wrong
      }

      const attempts = await withTenantTx(tenantId, async (t) => {
        const [challenge] = await t`
          select attempts from quote_email_challenges
          where session_id = ${sessionId}
          order by created_at desc limit 1
        `;
        return Number(challenge.attempts) as number;
      });
      expect(attempts).toBeGreaterThanOrEqual(1);
    } finally {
      await close();
    }
  });

  it("locks the challenge after the documented maximum of failed attempts", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) => requestQuoteOtp(tx, sessionToken));
      for (let i = 0; i < 5; i += 1) {
        try {
          await db.transaction((tx) =>
            verifyQuoteOtpForSession(tx, sessionToken, "000000"),
          );
        } catch {
          // expected for each wrong attempt
        }
      }
      const result = await withTenantTx(tenantId, async (t) => {
        const [challenge] = await t`
          select status, attempts from quote_email_challenges
          where session_id = ${sessionId}
          order by created_at desc limit 1
        `;
        return {
          status: challenge.status as string,
          attempts: Number(challenge.attempts) as number,
        };
      });
      expect(result.status).toBe("locked");
      expect(result.attempts).toBe(5);
      await expect(
        db.transaction((tx) => requestQuoteOtp(tx, sessionToken)),
      ).rejects.toThrow("QUOTE_OTP_LOCKED");
    } finally {
      await close();
    }
  });
});
