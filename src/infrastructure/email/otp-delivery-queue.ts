import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { publicOtpDeliveryJobs } from "@/infrastructure/database/schema";
import { getEnvironment } from "@/infrastructure/config/env";

export type OtpDeliveryTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

function leaseExpiresAt(leaseSeconds?: number) {
  const seconds = leaseSeconds ?? getEnvironment().INTEGRATION_JOB_LEASE_SECONDS;
  return new Date(Date.now() + seconds * 1000);
}

export async function claimOtpDeliveryJobs(
  tx: OtpDeliveryTransaction,
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
    .from(publicOtpDeliveryJobs)
    .where(
      and(
        eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
        or(
          eq(publicOtpDeliveryJobs.status, "pending"),
          eq(publicOtpDeliveryJobs.status, "retry"),
          and(
            eq(publicOtpDeliveryJobs.status, "processing"),
            lte(publicOtpDeliveryJobs.leaseExpiresAt, now),
          ),
        ),
        lte(publicOtpDeliveryJobs.availableAt, now),
      ),
    )
    .orderBy(asc(publicOtpDeliveryJobs.availableAt))
    .limit(input.batchSize ?? getEnvironment().INTEGRATION_JOB_BATCH_SIZE)
    .for("update", { skipLocked: true });

  const claimed = [];
  for (const row of rows) {
    const [updated] = await tx
      .update(publicOtpDeliveryJobs)
      .set({
        status: "processing",
        lockOwner: input.workerId,
        leaseExpiresAt: lease,
        attempts: sql`${publicOtpDeliveryJobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
          eq(publicOtpDeliveryJobs.id, row.id),
        ),
      )
      .returning();
    if (updated) claimed.push(updated);
  }
  return claimed;
}

export async function renewOtpDeliveryJobLease(
  tx: OtpDeliveryTransaction,
  input: { tenantId: string; jobId: string; workerId: string; leaseSeconds?: number },
) {
  const [updated] = await tx
    .update(publicOtpDeliveryJobs)
    .set({
      leaseExpiresAt: leaseExpiresAt(input.leaseSeconds),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
        eq(publicOtpDeliveryJobs.id, input.jobId),
        eq(publicOtpDeliveryJobs.status, "processing"),
        eq(publicOtpDeliveryJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: publicOtpDeliveryJobs.id });
  return Boolean(updated);
}

export async function completeOtpDeliveryJob(
  tx: OtpDeliveryTransaction,
  input: { tenantId: string; jobId: string; workerId: string },
) {
  const [updated] = await tx
    .update(publicOtpDeliveryJobs)
    .set({
      status: "sent",
      lockOwner: null,
      leaseExpiresAt: null,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
        eq(publicOtpDeliveryJobs.id, input.jobId),
        eq(publicOtpDeliveryJobs.status, "processing"),
        eq(publicOtpDeliveryJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: publicOtpDeliveryJobs.id });
  return Boolean(updated);
}

export async function failOtpDeliveryJob(
  tx: OtpDeliveryTransaction,
  input: {
    tenantId: string;
    jobId: string;
    workerId: string;
    retryable: boolean;
    attempts: number;
    maxAttempts: number;
    errorCode: string;
  },
) {
  const dead = !input.retryable || input.attempts >= input.maxAttempts;
  const delay =
    Math.min(3_600_000, 1_000 * 2 ** Math.min(input.attempts, 10)) +
    Math.floor(Math.random() * 500);
  const [updated] = await tx
    .update(publicOtpDeliveryJobs)
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
        eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
        eq(publicOtpDeliveryJobs.id, input.jobId),
        eq(publicOtpDeliveryJobs.status, "processing"),
        eq(publicOtpDeliveryJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: publicOtpDeliveryJobs.id });
  return Boolean(updated);
}

export async function releaseOtpDeliveryJob(
  tx: OtpDeliveryTransaction,
  input: { tenantId: string; jobId: string; workerId: string },
) {
  const [updated] = await tx
    .update(publicOtpDeliveryJobs)
    .set({
      status: "retry",
      availableAt: new Date(),
      lockOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publicOtpDeliveryJobs.tenantId, input.tenantId),
        eq(publicOtpDeliveryJobs.id, input.jobId),
        eq(publicOtpDeliveryJobs.status, "processing"),
        eq(publicOtpDeliveryJobs.lockOwner, input.workerId),
      ),
    )
    .returning({ id: publicOtpDeliveryJobs.id });
  return Boolean(updated);
}
