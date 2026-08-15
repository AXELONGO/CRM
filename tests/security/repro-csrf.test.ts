import { beforeEach, describe, expect, it } from "vitest";
import { hashPublicToken } from "../../src/modules/quotes/domain/public-token";
import {
  decidePublicQuote,
  requestQuoteOtp,
  verifyQuoteOtpForSession,
} from "../../src/modules/quotes/infrastructure/repositories";
import {
  ingressDb,
  migrationSql,
  resetTestDatabase,
  syntheticQuote,
  syntheticQuotePublicLink,
  syntheticQuotePublicSession,
  syntheticTenant,
  syntheticUser,
  withTenantTx,
} from "./db";

const tenantId = "tenant-a";
const userId = "user-a";
const quoteId = "quote-a";
const linkId = "link-a";
const sessionId = "session-a";
const sessionToken = "session-token-a";
const sessionHash = hashPublicToken(sessionToken);
const csrfHash = hashPublicToken("csrf-before");

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  await resetTestDatabase();
  const sql = migrationSql();
  try {
    await syntheticUser(sql, userId, "user-a@example.test");
    await syntheticTenant(sql, tenantId, userId);
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
      csrfHash,
    );
  } finally {
    await sql.end({ timeout: 2 });
  }
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into quote_versions (
        id, tenant_id, quote_id, version_number, snapshot, snapshot_hash, created_by_user_id
      ) values ('quote-version-a', ${tenantId}, ${quoteId}, 1, '{}'::jsonb, 'snapshot-a', ${userId})
    `;
  });
});

describe("repro C-04: CSRF token rotates when the public session is elevated", () => {
  it("rotates csrf_hash after a successful OTP verification", async () => {
    const { db, close } = ingressDb();
    try {
      const requested = (await db.transaction((tx) =>
        requestQuoteOtp(tx, sessionToken),
      )) as { testCode?: string };
      const code = requested.testCode as string;
      const verified = await db.transaction((tx) =>
        verifyQuoteOtpForSession(tx, sessionToken, code),
      );
      expect(verified.ok).toBe(true);
      const csrfAfter = await withTenantTx(tenantId, async (t) => {
        const [session] = await t`
          select csrf_hash from quote_public_sessions where id = ${sessionId}
        `;
        return session.csrf_hash as string;
      });
      expect(csrfAfter).not.toBe(csrfHash);
      const replay = await db.transaction((tx) =>
        verifyQuoteOtpForSession(tx, sessionToken, code),
      );
      expect(replay.ok).toBe(true);
      const recovered = await withTenantTx(tenantId, async (t) => {
        const [challenge] = await t`
          select attempts from quote_email_challenges where session_id = ${sessionId}
        `;
        const [session] = await t`
          select csrf_hash from quote_public_sessions where id = ${sessionId}
        `;
        return {
          attempts: Number(challenge.attempts),
          csrfHash: session.csrf_hash as string,
        };
      });
      expect(recovered.attempts).toBe(1);
      expect(recovered.csrfHash).not.toBe(csrfAfter);
    } finally {
      await close();
    }
  });

  it("returns the original decision for an idempotent retry after consuming OTP", async () => {
    const { db, close } = ingressDb();
    try {
      const requested = (await db.transaction((tx) =>
        requestQuoteOtp(tx, sessionToken),
      )) as { testCode?: string };
      const verified = await db.transaction((tx) =>
        verifyQuoteOtpForSession(tx, sessionToken, requested.testCode ?? ""),
      );
      if (!verified.ok) throw new Error("OTP_VERIFICATION_EXPECTED");
      const input = {
        sessionToken,
        csrfToken: verified.csrf,
        fullName: "Cliente de prueba",
        consent: true,
        decision: "accepted" as const,
        idempotencyKey: "quote-decision-retry-key",
      };
      const first = await db.transaction((tx) => decidePublicQuote(tx, input));
      const retry = await db.transaction((tx) => decidePublicQuote(tx, input));
      expect(first.repeated).toBe(false);
      expect(retry).toEqual({ id: first.id, repeated: true });
    } finally {
      await close();
    }
  });
});
