import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  exchangeAgreementLink,
  requestAgreementOtp,
  verifyAgreementOtp,
} from "../../src/modules/agreements/infrastructure/repositories";
import { hashOpaqueToken } from "../../src/modules/agreements/domain/crypto";
import {
  ingressDb,
  migrationSql,
  resetTestDatabase,
  syntheticTenant,
  syntheticUser,
  withMigrationTenantTx,
  withTenantTx,
} from "./db";

const tenantId = "tenant-agreement-otp";
const userId = "user-agreement-otp";
const quoteId = "quote-agreement-otp";
const quoteVersionId = "quote-version-agreement-otp";
const membershipId = "membership-agreement-otp";
const agreementId = "agreement-otp";
const agreementVersionId = "agreement-version-otp";
const envelopeId = "envelope-otp";
const recipientId = "recipient-otp";
const sessionId = "session-agreement-otp";
const sessionToken = "session-agreement-otp-token";
const snapshotHash = createHash("sha256").update("snapshot").digest("hex");
const contentHash = createHash("sha256").update("content").digest("hex");

async function seed() {
  await resetTestDatabase();
  const sql = migrationSql();
  try {
    await syntheticUser(sql, userId, "agreement-otp@example.test");
    await syntheticTenant(sql, tenantId, userId);
  } finally {
    await sql.end({ timeout: 2 });
  }
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into quotes (id, tenant_id, number, status, title, currency, created_by_user_id, updated_by_user_id)
      values (${quoteId}, ${tenantId}, 'COT-OTP', 'issued', 'Quote', 'MXN', ${userId}, ${userId})
    `;
    await t`
      insert into quote_versions (id, tenant_id, quote_id, version_number, snapshot, snapshot_hash, created_by_user_id)
      values (${quoteVersionId}, ${tenantId}, ${quoteId}, 1, '{}'::jsonb, ${snapshotHash}, ${userId})
    `;
    await t`
      insert into tenant_memberships (id, tenant_id, user_id, status)
      values (${membershipId}, ${tenantId}, ${userId}, 'active')
    `;
    await t`
      insert into agreements (
        id, tenant_id, agreement_type, status, title, quote_id, quote_version_id,
        owner_membership_id, created_by_user_id, updated_by_user_id
      ) values (
        ${agreementId}, ${tenantId}, 'fixed_project_service_agreement', 'issued', 'Agreement',
        ${quoteId}, ${quoteVersionId}, ${membershipId}, ${userId}, ${userId}
      )
    `;
    await t`
      insert into agreement_versions (
        id, tenant_id, agreement_id, version_number, document_number, status,
        source_quote_id, source_quote_version_id, source_quote_hash, snapshot,
        content_sha256, created_by_user_id
      ) values (
        ${agreementVersionId}, ${tenantId}, ${agreementId}, 1, 'CTR-OTP', 'issued',
        ${quoteId}, ${quoteVersionId}, ${snapshotHash},
        '{"sections":[],"title":"Agreement","parties":{}}'::jsonb,
        ${contentHash}, ${userId}
      )
    `;
    await t`
      insert into agreement_envelopes (
        id, tenant_id, agreement_id, version_id, method, signing_order, status,
        expires_at, generation, sender_membership_id
      ) values (
        ${envelopeId}, ${tenantId}, ${agreementId}, ${agreementVersionId},
        'internal_electronic_acceptance', 'parallel', 'sent', now() + interval '1 day',
        1, ${membershipId}
      )
    `;
    await t`
      insert into agreement_recipients (
        id, tenant_id, envelope_id, party_side, recipient_type, name_snapshot,
        email_snapshot, role_snapshot, signing_order, required, status
      ) values (
        ${recipientId}, ${tenantId}, ${envelopeId}, 'customer', 'external_contact',
        'Agreement recipient', 'recipient@example.test', 'Client', 1, true, 'available'
      )
    `;
    await t`
      insert into agreement_public_sessions (
        id, tenant_id, recipient_id, session_hash, csrf_hash, expires_at
      ) values (
        ${sessionId}, ${tenantId}, ${recipientId}, ${hashOpaqueToken(sessionToken)},
        ${hashOpaqueToken("agreement-csrf")}, now() + interval '1 day'
      )
    `;
  });
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  await seed();
});

describe("agreement OTP controls", () => {
  it("consumes an agreement link atomically under concurrent exchanges", async () => {
    const linkToken = "agreement-link-token";
    await withTenantTx(tenantId, async (t) => {
      await t`
        insert into agreement_recipient_links (
          id, tenant_id, recipient_id, token_hash, expires_at, active, generation
        ) values (
          'agreement-link-otp', ${tenantId}, ${recipientId}, ${hashOpaqueToken(linkToken)},
          now() + interval '1 day', true, 1
        )
      `;
    });
    const { db, close } = ingressDb();
    try {
      const results = await Promise.allSettled([
        db.transaction((tx) => exchangeAgreementLink(tx, linkToken)),
        db.transaction((tx) => exchangeAgreementLink(tx, linkToken)),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      const sessions = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select count(*)::int as count
          from agreement_public_sessions
          where recipient_id = ${recipientId}
        `;
        return Number(row.count);
      });
      expect(sessions).toBe(2);
    } finally {
      await close();
    }
  });

  it("queues encrypted delivery and rejects an immediate resend", async () => {
    const { db, close } = ingressDb();
    try {
      const code = await db.transaction((tx) => requestAgreementOtp(tx, sessionToken));
      expect(code).toMatch(/^\d{6}$/);
      await expect(
        db.transaction((tx) => requestAgreementOtp(tx, sessionToken)),
      ).rejects.toThrow("AGREEMENT_OTP_COOLDOWN");
      const delivery = await withMigrationTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select recipient, code_ciphertext, status
          from public_otp_delivery_jobs
          where kind = 'agreement-otp' and subject_id = ${sessionId}
        `;
        return row as { recipient: string; code_ciphertext: string; status: string };
      });
      expect(delivery.recipient).toBe("recipient@example.test");
      expect(delivery.status).toBe("pending");
      expect(delivery.code_ciphertext).not.toContain(code ?? "");
    } finally {
      await close();
    }
  });

  it("locks the agreement session after five persisted failures", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) => requestAgreementOtp(tx, sessionToken));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await db.transaction((tx) =>
          verifyAgreementOtp(tx, sessionToken, "000000"),
        );
        expect(result.ok).toBe(false);
      }
      const session = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select otp_attempts, otp_locked_at
          from agreement_public_sessions
          where id = ${sessionId}
        `;
        return row as { otp_attempts: number; otp_locked_at: Date | null };
      });
      expect(Number(session.otp_attempts)).toBe(5);
      expect(session.otp_locked_at).not.toBeNull();
      await expect(
        db.transaction((tx) => requestAgreementOtp(tx, sessionToken)),
      ).rejects.toThrow("AGREEMENT_OTP_LOCKED");
    } finally {
      await close();
    }
  });

  it("recovers a lost successful verification response without adding an attempt", async () => {
    const { db, close } = ingressDb();
    try {
      const code = await db.transaction((tx) => requestAgreementOtp(tx, sessionToken));
      if (!code) throw new Error("TEST_OTP_CODE_EXPECTED");
      const first = await db.transaction((tx) =>
        verifyAgreementOtp(tx, sessionToken, code),
      );
      const replay = await db.transaction((tx) =>
        verifyAgreementOtp(tx, sessionToken, code),
      );
      expect(first.ok).toBe(true);
      expect(replay.ok).toBe(true);
      const session = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select otp_attempts from agreement_public_sessions where id = ${sessionId}
        `;
        return Number(row.otp_attempts);
      });
      expect(session).toBe(1);
    } finally {
      await close();
    }
  });
});
