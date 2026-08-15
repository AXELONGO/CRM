import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, getWorkerDatabase } from "@/infrastructure/database/client";
import { decryptIntegrationSecret } from "@/infrastructure/encryption/integration-secrets";
import {
  claimIntegrationJobs,
  completeIntegrationJob,
  failIntegrationJob,
  releaseIntegrationJob,
  renewIntegrationJobLease,
} from "@/infrastructure/jobs/queue";
import {
  claimOtpDeliveryJobs,
  completeOtpDeliveryJob,
  failOtpDeliveryJob,
  releaseOtpDeliveryJob,
  renewOtpDeliveryJobLease,
} from "@/infrastructure/email/otp-delivery-queue";
import {
  inboxConnections,
  inboxMessages,
  integrationJobs,
  integrationSecretValues,
  integrationProviderEvents,
  tenants,
  webhookReceipts,
} from "@/infrastructure/database/schema";
import { ingestNormalizedEvent } from "@/modules/inbox/infrastructure/repositories";
import { MetaAdapter } from "@/modules/inbox/infrastructure/providers/meta/shared";
import { MetaLeadAdsAdapter } from "@/modules/inbox/infrastructure/providers/meta-leads/adapter";
import { WahaAdapter } from "@/modules/inbox/infrastructure/providers/waha/adapter";
import { WebFormAdapter } from "@/modules/inbox/infrastructure/providers/web-form/adapter";
import { getEnvironment } from "@/infrastructure/config/env";
import { emailSender } from "@/infrastructure/email/smtp-email-sender";
import { decryptOtpDeliveryCode } from "@/infrastructure/security/public-otp";
import {
  consumeOpportunityWon,
  enqueueOpportunityWonJobs,
} from "@/modules/projects/infrastructure/repositories";

const workerId = `worker:${process.pid}:${crypto.randomUUID()}`;
function adapterFor(channel: (typeof inboxConnections.channel.enumValues)[number]) {
  if (channel === "whatsapp_meta") return new MetaAdapter(channel);
  if (channel === "whatsapp_waha") return new WahaAdapter();
  if (channel === "meta_lead_ads") return new MetaLeadAdsAdapter();
  if (channel === "web_form") return new WebFormAdapter();
  if (channel === "messenger" || channel === "instagram")
    return new MetaAdapter(channel);
  throw new Error("WORKER_CHANNEL_UNSUPPORTED");
}
async function processJob(
  tx: Parameters<Parameters<ReturnType<typeof getWorkerDatabase>["transaction"]>[0]>[0],
  job: typeof integrationJobs.$inferSelect,
) {
  if (job.type === "create_project_draft_from_won") {
    const eventId = job.id.replace("project-won:", "");
    await consumeOpportunityWon(tx, { tenantId: job.tenantId, eventId });
    return;
  }
  if (job.type === "process_waha_provider_event" && job.connectionId) {
    const eventId = job.idempotencyKey.replace(`waha-event:${job.connectionId}:`, "");
    await tx
      .update(integrationProviderEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(
        and(
          eq(integrationProviderEvents.tenantId, job.tenantId),
          eq(integrationProviderEvents.connectionId, job.connectionId),
          eq(integrationProviderEvents.dedupKey, eventId),
        ),
      );
    return;
  }
  if (job.type === "process_webhook" && job.receiptId && job.connectionId) {
    const [receipt] = await tx
      .select()
      .from(webhookReceipts)
      .where(
        and(
          eq(webhookReceipts.tenantId, job.tenantId),
          eq(webhookReceipts.id, job.receiptId),
        ),
      )
      .limit(1);
    const [connection] = await tx
      .select()
      .from(inboxConnections)
      .where(
        and(
          eq(inboxConnections.tenantId, job.tenantId),
          eq(inboxConnections.id, job.connectionId),
        ),
      )
      .limit(1);
    if (!receipt || !connection) throw new Error("WORKER_REFERENCE_NOT_FOUND");
    const secretsRows = await tx
      .select()
      .from(integrationSecretValues)
      .where(
        and(
          eq(integrationSecretValues.tenantId, job.tenantId),
          eq(integrationSecretValues.connectionId, connection.id),
        ),
      );
    const secrets: Record<string, string> = {};
    for (const secret of secretsRows)
      secrets[secret.logicalName] = decryptIntegrationSecret(
        { ...secret, algorithm: secret.algorithm as "aes-256-gcm" },
        `secret/${job.tenantId}/${connection.id}/${secret.logicalName}`,
      );
    const raw = Buffer.from(
      decryptIntegrationSecret(
        {
          algorithm: "aes-256-gcm" as const,
          ciphertext: receipt.bodyCiphertext,
          nonce: receipt.bodyNonce,
          authenticationTag: receipt.bodyAuthenticationTag,
          keyVersion: receipt.keyVersion ?? 1,
          fingerprint: "",
        },
        `receipt/${job.tenantId}/${connection.id}/${receipt.bodyHash}`,
      ),
      "base64",
    );
    const adapter = adapterFor(connection.channel);
    const events = adapter.normalizeInbound(raw, {
      id: connection.id,
      channel: connection.channel,
      externalIdentifiers: connection.externalIdentifiers as Record<string, string>,
      secrets,
    });
    for (const event of events) await ingestNormalizedEvent(tx, job.tenantId, event);
    await tx
      .update(webhookReceipts)
      .set({
        status: "processed",
        processedAt: new Date(),
        attempts: sql`${webhookReceipts.attempts} + 1`,
      })
      .where(
        and(
          eq(webhookReceipts.tenantId, job.tenantId),
          eq(webhookReceipts.id, receipt.id),
        ),
      );
    return;
  }
  if (job.type === "send_message") {
    if (!job.messageId || !job.connectionId)
      throw new Error("OUTBOUND_MESSAGE_REFERENCE_REQUIRED");
    const [message] = await tx
      .select()
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.tenantId, job.tenantId),
          eq(inboxMessages.id, job.messageId),
          eq(inboxMessages.connectionId, job.connectionId),
          eq(inboxMessages.status, "queued"),
        ),
      )
      .limit(1);
    if (!message) throw new Error("OUTBOUND_MESSAGE_NOT_FOUND");
    await tx
      .update(inboxMessages)
      .set({
        status: "sent",
        externalMessageId: `simulated:${message.id}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(inboxMessages.tenantId, job.tenantId), eq(inboxMessages.id, message.id)),
      );
    return;
  }
  throw new Error("WORKER_JOB_UNSUPPORTED");
}

async function processOtpDeliveryJob(
  job: Awaited<ReturnType<typeof claimOtpDeliveryJobs>>[number],
) {
  const code = decryptOtpDeliveryCode(
    {
      ciphertext: job.codeCiphertext,
      nonce: job.codeNonce,
      authenticationTag: job.codeAuthenticationTag,
      keyVersion: job.keyVersion,
    },
    `otp-delivery:${job.kind}:${job.subjectId}`,
  );
  const url = new URL(
    job.kind === "quote-otp" ? "/q" : "/a",
    getEnvironment().APP_BASE_URL,
  );
  await emailSender.send({
    kind: job.kind,
    recipient: job.recipient,
    recipientName: job.recipientName,
    url: url.toString(),
    code,
  });
}

async function withTenantTransaction<T>(
  tenantId: string,
  fn: (
    tx: Parameters<
      Parameters<ReturnType<typeof getWorkerDatabase>["transaction"]>[0]
    >[0],
  ) => Promise<T>,
) {
  return getWorkerDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return fn(tx);
  });
}

async function processClaimedIntegrationJob(job: typeof integrationJobs.$inferSelect) {
  await withTenantTransaction(job.tenantId, async (tx) => {
    if (
      !(await renewIntegrationJobLease(tx, {
        tenantId: job.tenantId,
        jobId: job.id,
        workerId,
      }))
    ) {
      return;
    }
    try {
      await processJob(tx, job);
      await completeIntegrationJob(tx, {
        tenantId: job.tenantId,
        jobId: job.id,
        workerId,
      });
    } catch (error) {
      await failIntegrationJob(tx, {
        tenantId: job.tenantId,
        jobId: job.id,
        workerId,
        retryable:
          error instanceof Error &&
          ![
            "WORKER_JOB_UNSUPPORTED",
            "OUTBOUND_MESSAGE_NOT_FOUND",
            "OUTBOUND_MESSAGE_REFERENCE_REQUIRED",
          ].includes(error.message),
        errorCode: error instanceof Error ? error.message : "WORKER_UNKNOWN_ERROR",
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
    }
  });
}

async function processClaimedOtpDeliveryJob(
  job: Awaited<ReturnType<typeof claimOtpDeliveryJobs>>[number],
) {
  const owned = await withTenantTransaction(job.tenantId, (tx) =>
    renewOtpDeliveryJobLease(tx, {
      tenantId: job.tenantId,
      jobId: job.id,
      workerId,
    }),
  );
  if (!owned) return;
  try {
    await processOtpDeliveryJob(job);
    await withTenantTransaction(job.tenantId, (tx) =>
      completeOtpDeliveryJob(tx, {
        tenantId: job.tenantId,
        jobId: job.id,
        workerId,
      }),
    );
  } catch (error) {
    await withTenantTransaction(job.tenantId, (tx) =>
      failOtpDeliveryJob(tx, {
        tenantId: job.tenantId,
        jobId: job.id,
        workerId,
        retryable: true,
        errorCode: error instanceof Error ? error.message : "OTP_DELIVERY_UNKNOWN",
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      }),
    );
  }
}

async function releaseClaimedJobs(
  tenantId: string,
  jobs: Array<typeof integrationJobs.$inferSelect>,
  otpJobs: Awaited<ReturnType<typeof claimOtpDeliveryJobs>>,
) {
  await withTenantTransaction(tenantId, async (tx) => {
    for (const job of jobs)
      await releaseIntegrationJob(tx, { tenantId, jobId: job.id, workerId });
    for (const job of otpJobs)
      await releaseOtpDeliveryJob(tx, { tenantId, jobId: job.id, workerId });
  });
}

export async function runWorkerOnce() {
  const db = getWorkerDatabase();
  const targetTenants = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.status, "active"));
  for (const tenant of targetTenants) {
    if (stopping) break;
    const { jobs, otpJobs } = await withTenantTransaction(tenant.id, async (tx) => {
      await enqueueOpportunityWonJobs(tx, tenant.id);
      return {
        jobs: await claimIntegrationJobs(tx, { tenantId: tenant.id, workerId }),
        otpJobs: await claimOtpDeliveryJobs(tx, { tenantId: tenant.id, workerId }),
      };
    });
    let integrationIndex = 0;
    for (; integrationIndex < jobs.length && !stopping; integrationIndex += 1) {
      await processClaimedIntegrationJob(jobs[integrationIndex]);
    }
    if (stopping) {
      await releaseClaimedJobs(tenant.id, jobs.slice(integrationIndex), otpJobs);
      break;
    }
    let otpIndex = 0;
    for (; otpIndex < otpJobs.length && !stopping; otpIndex += 1) {
      await processClaimedOtpDeliveryJob(otpJobs[otpIndex]);
    }
    if (stopping) {
      await releaseClaimedJobs(tenant.id, [], otpJobs.slice(otpIndex));
      break;
    }
  }
}

let stopping = false;
let wakePoll: (() => void) | undefined;

function requestStop() {
  stopping = true;
  wakePoll?.();
}

async function waitForNextPoll() {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, getEnvironment().INTEGRATION_WORKER_POLL_MS);
    wakePoll = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  wakePoll = undefined;
}

async function main() {
  process.once("SIGTERM", requestStop);
  process.once("SIGINT", requestStop);
  try {
    if (process.env.INTEGRATION_WORKER_RUN_ONCE === "true") {
      await runWorkerOnce();
      return;
    }
    while (!stopping) {
      await runWorkerOnce();
      if (!stopping) await waitForNextPoll();
    }
  } finally {
    await closeDatabase();
  }
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    console.error(
      "integration-worker failed",
      error instanceof Error ? error.message : "unknown",
    );
    process.exitCode = 1;
  });
}
