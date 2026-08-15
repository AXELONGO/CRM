import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { integrationJobs } from "@/infrastructure/database/schema";
import { getEnvironment } from "@/infrastructure/config/env";

export type JobTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function leaseExpiresAt(leaseSeconds?: number) {
  const seconds = leaseSeconds ?? getEnvironment().INTEGRATION_JOB_LEASE_SECONDS;
  return new Date(Date.now() + seconds * 1000);
}

export async function claimIntegrationJobs(
  tx: JobTransaction,
  input: {
    tenantId: string;
    workerId: string;
    batchSize?: number;
    leaseSeconds?: number;
  },
) {
  const now = new Date();
  const lease = leaseExpiresAt(input.leaseSeconds);
  const rows = await tx
    .select()
    .from(integrationJobs)
    .where(
      and(
        eq(integrationJobs.tenantId, input.tenantId),
        or(
          eq(integrationJobs.status, "pending"),
          eq(integrationJobs.status, "retry"),
          and(
            eq(integrationJobs.status, "processing"),
            lte(integrationJobs.leaseExpiresAt, now),
          ),
        ),
        lte(integrationJobs.availableAt, now),
      ),
    )
    .orderBy(asc(integrationJobs.priority), asc(integrationJobs.availableAt))
    .limit(input.batchSize ?? getEnvironment().INTEGRATION_JOB_BATCH_SIZE)
    .for("update", { skipLocked: true });
  if (!rows.length) return [];
  const claimed = [];
  for (const row of rows) {
    const [updated] = await tx
      .update(integrationJobs)
      .set({
        status: "processing",
        lockOwner: input.workerId,
        lockedAt: now,
        leaseExpiresAt: lease,
        attempts: sql`${integrationJobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(integrationJobs.tenantId, input.tenantId),
          eq(integrationJobs.id, row.id),
        ),
      )
      .returning();
    if (updated) claimed.push(updated);
  }
  return claimed;
}

export async function renewIntegrationJobLease(
  tx: JobTransaction,
  input: { tenantId: string; jobId: string; workerId: string; leaseSeconds?: number },
) {
  const [updated] = await tx
    .update(integrationJobs)
    .set({
      leaseExpiresAt: leaseExpiresAt(input.leaseSeconds),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationJobs.tenantId, input.tenantId),
        eq(integrationJobs.id, input.jobId),
        eq(integrationJobs.status, "processing"),
        eq(integrationJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: integrationJobs.id });
  return Boolean(updated);
}

export async function completeIntegrationJob(
  tx: JobTransaction,
  input: { tenantId: string; jobId: string; workerId: string },
) {
  const [updated] = await tx
    .update(integrationJobs)
    .set({
      status: "succeeded",
      lockOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationJobs.tenantId, input.tenantId),
        eq(integrationJobs.id, input.jobId),
        eq(integrationJobs.status, "processing"),
        eq(integrationJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: integrationJobs.id });
  return Boolean(updated);
}

export async function failIntegrationJob(
  tx: JobTransaction,
  input: {
    tenantId: string;
    jobId: string;
    workerId: string;
    retryable: boolean;
    errorCode: string;
    attempts: number;
    maxAttempts: number;
  },
) {
  const dead = !input.retryable || input.attempts >= input.maxAttempts;
  const delay =
    Math.min(3_600_000, 1_000 * 2 ** Math.min(input.attempts, 10)) +
    Math.floor(Math.random() * 500);
  const [updated] = await tx
    .update(integrationJobs)
    .set({
      status: dead ? "dead" : "retry",
      availableAt: new Date(Date.now() + delay),
      lockOwner: null,
      leaseExpiresAt: null,
      lastErrorCode: input.errorCode.slice(0, 120),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationJobs.tenantId, input.tenantId),
        eq(integrationJobs.id, input.jobId),
        eq(integrationJobs.status, "processing"),
        eq(integrationJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: integrationJobs.id });
  return Boolean(updated);
}

export async function releaseIntegrationJob(
  tx: JobTransaction,
  input: { tenantId: string; jobId: string; workerId: string },
) {
  const [updated] = await tx
    .update(integrationJobs)
    .set({
      status: "retry",
      availableAt: new Date(),
      lockOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationJobs.tenantId, input.tenantId),
        eq(integrationJobs.id, input.jobId),
        eq(integrationJobs.status, "processing"),
        eq(integrationJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: integrationJobs.id });
  return Boolean(updated);
}
