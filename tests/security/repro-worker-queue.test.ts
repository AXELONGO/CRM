import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../src/infrastructure/database/client";
import {
  claimOtpDeliveryJobs,
  completeOtpDeliveryJob,
} from "../../src/infrastructure/email/otp-delivery-queue";
import {
  claimIntegrationJobs,
  completeIntegrationJob,
} from "../../src/infrastructure/jobs/queue";
import { runAutomationWorkerOnce } from "../../scripts/automation-worker";
import { runWorkerOnce } from "../../scripts/integration-worker";
import {
  type TestDb,
  drizzleFrom,
  ingressSql,
  migrationSql,
  resetTestDatabase,
  syntheticTenant,
  syntheticUser,
  withMigrationTenantTx,
  withTenantTx,
  workerSql,
  workerURL_,
} from "./db";

const tenantId = "tenant-worker-queue";
const userId = "user-worker-queue";
const connectionId = "connection-worker-queue";
const conversationId = "conversation-worker-queue";
const targetMessageId = "message-worker-target";
const otherMessageId = "message-worker-other";

type WorkerTransaction = Parameters<Parameters<TestDb["transaction"]>[0]>[0];

async function withWorkerTx<T>(fn: (tx: WorkerTransaction) => Promise<T>): Promise<T> {
  const client = workerSql();
  const db = drizzleFrom(client);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );
      return fn(tx);
    });
  } finally {
    await client.end({ timeout: 2 });
  }
}

async function insertIntegrationJob(input: { id: string; messageId?: string | null }) {
  const client = ingressSql();
  try {
    await client.begin(async (tx) => {
      await tx`select set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx`
        insert into inbox_integration_jobs (
          id, tenant_id, connection_id, message_id, type, idempotency_key
        ) values (
          ${input.id}, ${tenantId}, ${input.messageId ? connectionId : null},
          ${input.messageId ?? null}, 'send_message', ${`send:${tenantId}:${input.messageId ?? input.id}`}
        )
      `;
    });
  } finally {
    await client.end({ timeout: 2 });
  }
}

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_WORKER_URL = workerURL_;
  process.env.APP_BASE_URL = "http://localhost:3000";
  await resetTestDatabase();
  const migration = migrationSql();
  try {
    await syntheticUser(migration, userId, "worker-queue@example.test");
    await syntheticTenant(migration, tenantId, userId);
  } finally {
    await migration.end({ timeout: 2 });
  }
  await withTenantTx(tenantId, async (tx) => {
    await tx`
      insert into inbox_connections (
        id, tenant_id, channel, name, status, external_identifiers, capabilities,
        created_by_user_id, updated_by_user_id
      ) values (
        ${connectionId}, ${tenantId}, 'web_form', 'Worker queue', 'active', '{}'::jsonb,
        '{}'::jsonb, ${userId}, ${userId}
      )
    `;
    await tx`
      insert into inbox_conversations (
        id, tenant_id, connection_id, channel, external_thread_id
      ) values (
        ${conversationId}, ${tenantId}, ${connectionId}, 'web_form', 'worker-thread'
      )
    `;
    await tx`
      insert into inbox_messages (
        id, tenant_id, conversation_id, connection_id, direction, kind, body_text, status,
        server_sequence
      ) values
        (${targetMessageId}, ${tenantId}, ${conversationId}, ${connectionId}, 'outbound', 'text', 'target', 'queued', 1),
        (${otherMessageId}, ${tenantId}, ${conversationId}, ${connectionId}, 'outbound', 'text', 'other', 'queued', 2)
    `;
  });
});

afterEach(async () => {
  await closeDatabase();
});

describe("worker queue ownership and targeting", () => {
  it("processes only the message referenced by an outbound job", async () => {
    await insertIntegrationJob({ id: "job-worker-target", messageId: targetMessageId });

    await runWorkerOnce();

    const result = await withWorkerTx(async (tx) => {
      const messages = (await tx.execute(sql`
        select id, status from inbox_messages
        where id in (${targetMessageId}, ${otherMessageId})
        order by id
      `)) as unknown as Array<{ id: string; status: string }>;
      const rows = (await tx.execute(sql`
        select status from inbox_integration_jobs where id = 'job-worker-target'
      `)) as unknown as Array<{ status: string }>;
      return { messages, jobStatus: rows[0]?.status };
    });
    expect(result.messages).toEqual([
      { id: otherMessageId, status: "queued" },
      { id: targetMessageId, status: "sent" },
    ]);
    expect(result.jobStatus).toBe("succeeded");
  });

  it("rejects stale owners and lets another worker recover an expired lease", async () => {
    await insertIntegrationJob({ id: "job-worker-lease" });
    const [firstClaim] = await withWorkerTx((tx) =>
      claimIntegrationJobs(tx, {
        tenantId,
        workerId: "worker-a",
        leaseSeconds: -1,
      }),
    );
    expect(firstClaim).toBeTruthy();

    const staleCompletion = await withWorkerTx((tx) =>
      completeIntegrationJob(tx, {
        tenantId,
        jobId: firstClaim.id,
        workerId: "worker-b",
      }),
    );
    expect(staleCompletion).toBe(false);

    const [recoveredClaim] = await withWorkerTx((tx) =>
      claimIntegrationJobs(tx, { tenantId, workerId: "worker-b" }),
    );
    expect(recoveredClaim.lockOwner).toBe("worker-b");
    expect(recoveredClaim.attempts).toBe(2);
    const completion = await withWorkerTx((tx) =>
      completeIntegrationJob(tx, {
        tenantId,
        jobId: recoveredClaim.id,
        workerId: "worker-b",
      }),
    );
    expect(completion).toBe(true);
  });

  it("applies the same owner check to OTP delivery jobs", async () => {
    await withMigrationTenantTx(tenantId, async (tx) => {
      await tx`
        insert into public_otp_delivery_jobs (
          id, tenant_id, kind, subject_id, recipient, recipient_name, code_ciphertext,
          code_nonce, code_authentication_tag, key_version, idempotency_key
        ) values (
          'otp-worker-owner', ${tenantId}, 'quote-otp', 'otp-subject', 'recipient@example.test',
          'Recipient', 'ciphertext', 'nonce', 'tag', 1, 'otp-worker-owner'
        )
      `;
    });
    const [claim] = await withWorkerTx((tx) =>
      claimOtpDeliveryJobs(tx, { tenantId, workerId: "worker-a" }),
    );
    const staleCompletion = await withWorkerTx((tx) =>
      completeOtpDeliveryJob(tx, {
        tenantId,
        jobId: claim.id,
        workerId: "worker-b",
      }),
    );
    expect(staleCompletion).toBe(false);
    const completion = await withWorkerTx((tx) =>
      completeOtpDeliveryJob(tx, {
        tenantId,
        jobId: claim.id,
        workerId: "worker-a",
      }),
    );
    expect(completion).toBe(true);
  });

  it("retries failed automation jobs after releasing their lease", async () => {
    await withTenantTx(tenantId, async (tx) => {
      await tx`
        insert into automation_jobs (id, tenant_id, type, idempotency_key)
        values ('automation-worker-retry', ${tenantId}, 'unsupported', 'automation-worker-retry')
      `;
    });

    await runAutomationWorkerOnce();

    const result = await withWorkerTx(async (tx) => {
      const rows = (await tx.execute(sql`
        select status, attempts, lock_owner, lease_expires_at, available_at
        from automation_jobs where id = 'automation-worker-retry'
      `)) as unknown as Array<{
        status: string;
        attempts: number;
        lock_owner: string | null;
        lease_expires_at: Date | null;
        available_at: Date;
      }>;
      return rows[0];
    });
    expect(result.status).toBe("retry");
    expect(Number(result.attempts)).toBe(1);
    expect(result.lock_owner).toBeNull();
    expect(result.lease_expires_at).toBeNull();
    expect(new Date(result.available_at).getTime()).toBeGreaterThan(Date.now());
  });
});
