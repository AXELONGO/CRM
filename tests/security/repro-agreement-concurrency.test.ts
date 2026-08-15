import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  acceptAgreementInternally,
  acceptAgreementPublicly,
  recordExternalPdf,
  verifyExternalPdf,
} from "../../src/modules/agreements/infrastructure/repositories";
import { hashOpaqueToken } from "../../src/modules/agreements/domain/crypto";
import {
  ingressDb,
  migrationSql,
  resetTestDatabase,
  runtimeDb,
  syntheticTenant,
  syntheticUser,
  withTenantTx,
} from "./db";

const tenantId = "tenant-a";
const userId = "user-a";
const reviewerUserId = "user-reviewer";
const quoteId = "quote-a";
const quoteVersionId = "qv-a";
const agreementId = "agr-a";
const agreementVersionId = "av-a";
const envelopeId = "env-a";
const membershipId = "mem-a";
const recipientProvider = "rec-provider";
const recipientCustomer = "rec-customer";
const recipientWitness = "rec-witness";
const sessionCustomer = "ses-customer";
const sessionCustomerRetry = "ses-customer-retry";
const csrf = "csrf-token-a";
const snapshotHash = createHash("sha256").update("snapshot").digest("hex");
const contentSha = createHash("sha256").update("content").digest("hex");

async function seed() {
  await resetTestDatabase();
  const sql = migrationSql();
  try {
    await syntheticUser(sql, userId, "user-a@example.test");
    await syntheticUser(sql, reviewerUserId, "reviewer@example.test");
    await syntheticTenant(sql, tenantId, userId);
  } finally {
    await sql.end({ timeout: 2 });
  }
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into quotes (id, tenant_id, number, status, title, currency, created_by_user_id, updated_by_user_id)
      values (${quoteId}, ${tenantId}, 'COT-1', 'issued', 'Quote', 'MXN', ${userId}, ${userId})
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
      insert into agreements (id, tenant_id, agreement_type, status, title, quote_id, quote_version_id, owner_membership_id, current_version_id, active_envelope_id, execution_method, created_by_user_id, updated_by_user_id)
      values (${agreementId}, ${tenantId}, 'fixed_project_service_agreement', 'issued', 'Acuerdo', ${quoteId}, ${quoteVersionId}, ${membershipId}, ${agreementVersionId}, ${envelopeId}, 'internal_electronic_acceptance', ${userId}, ${userId})
    `;
    await t`
      insert into agreement_versions (id, tenant_id, agreement_id, version_number, document_number, status, source_quote_id, source_quote_version_id, source_quote_hash, snapshot, content_sha256, created_by_user_id)
      values (${agreementVersionId}, ${tenantId}, ${agreementId}, 1, 'CTR-1', 'issued', ${quoteId}, ${quoteVersionId}, ${snapshotHash}, '{"sections":[],"title":"Acuerdo","parties":{}}'::jsonb, ${contentSha}, ${userId})
    `;
    await t`
      insert into agreement_envelopes (id, tenant_id, agreement_id, version_id, method, signing_order, status, expires_at, generation, sender_membership_id)
      values (${envelopeId}, ${tenantId}, ${agreementId}, ${agreementVersionId}, 'internal_electronic_acceptance', 'parallel', 'sent', now() + interval '1 day', 1, ${membershipId})
    `;
    await t`
      insert into agreement_recipients (id, tenant_id, envelope_id, party_side, recipient_type, membership_id, name_snapshot, email_snapshot, role_snapshot, signing_order, required, status)
      values
        (${recipientProvider}, ${tenantId}, ${envelopeId}, 'provider', 'internal_member', ${membershipId}, 'Proveedor', 'provider@example.test', 'Proveedor', 1, true, 'available'),
        (${recipientCustomer}, ${tenantId}, ${envelopeId}, 'customer', 'external_contact', null, 'Cliente', 'customer@example.test', 'Cliente', 2, true, 'available')
    `;
    await t`
      insert into agreement_public_sessions (id, tenant_id, recipient_id, session_hash, csrf_hash, expires_at, verified_at, last_seen_at)
      values
        (${sessionCustomer}, ${tenantId}, ${recipientCustomer}, ${hashOpaqueToken("session-customer-token")}, ${hashOpaqueToken(csrf)}, now() + interval '1 day', now(), now())
    `;
  });
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  await seed();
});

describe("repro F-01: concurrent signing must complete the envelope exactly once", () => {
  it("leaves the envelope signatures_complete when both signers accept concurrently", async () => {
    const { db: ingress, close: closeIngress } = ingressDb();
    const { db: runtime, close: closeRuntime } = runtimeDb();
    try {
      const runExternal = () =>
        ingress.transaction((tx) =>
          acceptAgreementPublicly(tx, {
            sessionToken: "session-customer-token",
            csrfToken: csrf,
            fullName: "Cliente",
            declaredAuthority: true,
            consent: true,
            idempotencyKey: `acc-${recipientCustomer}`,
            action: "accepted",
          }),
        );
      const runInternal = () =>
        runtime.transaction(async (tx) => {
          await tx.execute(
            sql`
              select set_config('app.current_tenant_id', ${tenantId}, true)
            `,
          );
          return acceptAgreementInternally(tx, {
            tenantId,
            agreementId,
            membershipId,
            userId,
            fullName: "Proveedor",
            idempotencyKey: `acc-${recipientProvider}`,
          });
        });
      await Promise.all([runInternal(), runExternal()]);
      const repeated = await ingress.transaction((tx) =>
        acceptAgreementPublicly(tx, {
          sessionToken: "session-customer-token",
          csrfToken: csrf,
          fullName: "Cliente",
          declaredAuthority: true,
          consent: true,
          idempotencyKey: `acc-${recipientCustomer}`,
          action: "accepted",
        }),
      );
      expect(repeated.repeated).toBe(true);
      const result = await withTenantTx(tenantId, async (t) => {
        const [envelope] = await t`
          select status from agreement_envelopes where id = ${envelopeId}
        `;
        const [actions] = await t`
          select count(*)::int as count from agreement_acceptance_actions
          where envelope_id = ${envelopeId}
        `;
        const [evidence] = await t`
          select count(*)::int as count from agreement_evidence_bundles
          where envelope_id = ${envelopeId}
        `;
        const [executed] = await t`
          select count(*)::int as count from agreement_outbox_events
          where aggregate_id = ${agreementId} and name = 'AgreementExecuted.v1'
        `;
        return {
          status: envelope.status as string,
          count: actions.count as number,
          evidence: evidence.count as number,
          executed: executed.count as number,
        };
      });
      expect(result.status).toBe("completed");
      expect(result.count).toBe(2);
      expect(result.evidence).toBe(1);
      expect(result.executed).toBe(1);
    } finally {
      await closeIngress();
      await closeRuntime();
    }
  });

  it("rejects a mutated replay with the same idempotency key", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) =>
        acceptAgreementPublicly(tx, {
          sessionToken: "session-customer-token",
          csrfToken: csrf,
          fullName: "Cliente",
          declaredAuthority: true,
          consent: true,
          idempotencyKey: `acc-${recipientCustomer}`,
          action: "accepted",
        }),
      );
      await expect(
        db.transaction((tx) =>
          acceptAgreementPublicly(tx, {
            sessionToken: "session-customer-token",
            csrfToken: csrf,
            fullName: "Cliente cambiado",
            declaredAuthority: true,
            consent: true,
            idempotencyKey: `acc-${recipientCustomer}`,
            action: "accepted",
          }),
        ),
      ).rejects.toThrow("AGREEMENT_IDEMPOTENCY_CONFLICT");
    } finally {
      await close();
    }
  });

  it("binds an idempotency key to the public session that issued it", async () => {
    await withTenantTx(tenantId, async (t) => {
      await t`
        insert into agreement_public_sessions (
          id, tenant_id, recipient_id, session_hash, csrf_hash, expires_at, verified_at, last_seen_at
        ) values (
          ${sessionCustomerRetry}, ${tenantId}, ${recipientCustomer},
          ${hashOpaqueToken("session-customer-retry-token")}, ${hashOpaqueToken(csrf)},
          now() + interval '1 day', now(), now()
        )
      `;
    });
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) =>
        acceptAgreementPublicly(tx, {
          sessionToken: "session-customer-token",
          csrfToken: csrf,
          fullName: "Cliente",
          declaredAuthority: true,
          consent: true,
          idempotencyKey: `acc-${recipientCustomer}`,
          action: "accepted",
        }),
      );
      await expect(
        db.transaction((tx) =>
          acceptAgreementPublicly(tx, {
            sessionToken: "session-customer-retry-token",
            csrfToken: csrf,
            fullName: "Cliente",
            declaredAuthority: true,
            consent: true,
            idempotencyKey: `acc-${recipientCustomer}`,
            action: "accepted",
          }),
        ),
      ).rejects.toThrow("AGREEMENT_IDEMPOTENCY_CONFLICT");
    } finally {
      await close();
    }
  });

  it("waits for every required recipient before completing evidence", async () => {
    await withTenantTx(tenantId, async (t) => {
      await t`
        insert into agreement_recipients (
          id, tenant_id, envelope_id, party_side, recipient_type, membership_id,
          name_snapshot, email_snapshot, role_snapshot, signing_order, required, status
        ) values (
          ${recipientWitness}, ${tenantId}, ${envelopeId}, 'witness', 'external_contact', null,
          'Testigo', 'witness@example.test', 'Testigo', 2, true, 'pending'
        )
      `;
    });
    const { db: ingress, close: closeIngress } = ingressDb();
    const { db: runtime, close: closeRuntime } = runtimeDb();
    try {
      await Promise.all([
        runtime.transaction(async (tx) => {
          await tx.execute(
            sql`
              select set_config('app.current_tenant_id', ${tenantId}, true)
            `,
          );
          return acceptAgreementInternally(tx, {
            tenantId,
            agreementId,
            membershipId,
            userId,
            fullName: "Proveedor",
            idempotencyKey: `acc-${recipientProvider}`,
          });
        }),
        ingress.transaction((tx) =>
          acceptAgreementPublicly(tx, {
            sessionToken: "session-customer-token",
            csrfToken: csrf,
            fullName: "Cliente",
            declaredAuthority: true,
            consent: true,
            idempotencyKey: `acc-${recipientCustomer}`,
            action: "accepted",
          }),
        ),
      ]);
      const result = await withTenantTx(tenantId, async (t) => {
        const [envelope] = await t`
          select status from agreement_envelopes where id = ${envelopeId}
        `;
        const [evidence] = await t`
          select count(*)::int as count from agreement_evidence_bundles
          where envelope_id = ${envelopeId}
        `;
        return {
          status: envelope.status as string,
          evidence: evidence.count as number,
        };
      });
      expect(result.status).toBe("partially_completed");
      expect(result.evidence).toBe(0);
    } finally {
      await closeIngress();
      await closeRuntime();
    }
  });

  it("does not verify external evidence through another agreement route", async () => {
    await withTenantTx(tenantId, async (t) => {
      await t`
        update agreement_envelopes
        set method = 'external_signed_pdf'
        where id = ${envelopeId}
      `;
      await t`
        update agreements
        set execution_method = 'external_signed_pdf'
        where id = ${agreementId}
      `;
    });
    const { db, close } = runtimeDb();
    try {
      const record = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            select set_config('app.current_tenant_id', ${tenantId}, true)
          `,
        );
        return recordExternalPdf(tx, {
          tenantId,
          agreementId,
          versionId: agreementVersionId,
          userId,
          storageKey: "agreements/test/external.pdf",
          fileSha256: contentSha,
          sizeBytes: 42,
        });
      });
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(
            sql`
              select set_config('app.current_tenant_id', ${tenantId}, true)
            `,
          );
          return verifyExternalPdf(tx, {
            tenantId,
            agreementId: "another-agreement",
            recordId: record.id,
            reviewerUserId,
            comment: "Validado por un revisor distinto.",
          });
        }),
      ).rejects.toThrow("EXTERNAL_EVIDENCE_NOT_REVIEWABLE");
    } finally {
      await close();
    }
  });

  it("does not reopen an envelope after a recipient declines", async () => {
    const { db: ingress, close: closeIngress } = ingressDb();
    const { db: runtime, close: closeRuntime } = runtimeDb();
    try {
      await ingress.transaction((tx) =>
        acceptAgreementPublicly(tx, {
          sessionToken: "session-customer-token",
          csrfToken: csrf,
          fullName: "Cliente",
          declaredAuthority: true,
          consent: true,
          idempotencyKey: `decline-${recipientCustomer}`,
          action: "declined",
        }),
      );
      await expect(
        runtime.transaction(async (tx) => {
          await tx.execute(
            sql`
              select set_config('app.current_tenant_id', ${tenantId}, true)
            `,
          );
          return acceptAgreementInternally(tx, {
            tenantId,
            agreementId,
            membershipId,
            userId,
            fullName: "Proveedor",
            idempotencyKey: `acc-${recipientProvider}`,
          });
        }),
      ).rejects.toThrow("ENVELOPE_NOT_OPEN");
      const status = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select status from agreement_envelopes where id = ${envelopeId}
        `;
        return row.status as string;
      });
      expect(status).toBe("declined");
    } finally {
      await closeIngress();
      await closeRuntime();
    }
  });
});
