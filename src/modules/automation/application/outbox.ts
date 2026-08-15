import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { automationEvents, automationJobs } from "@/infrastructure/database/schema";
import { actionIdempotencyKey } from "../domain/engine";

type EventInput = {
  id: string;
  tenantId: string;
  name: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  source: "manual" | "integration" | "import" | "system" | "automation";
  correlationId: string;
  causationEventId?: string;
  causationDepth?: number;
  payload: Record<string, unknown>;
};

export async function publishAutomationEvent(event: EventInput) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${event.tenantId}, true)`,
    );
    const [stored] = await tx
      .insert(automationEvents)
      .values({ ...event, causationDepth: event.causationDepth ?? 0 })
      .onConflictDoNothing({ target: automationEvents.id })
      .returning();
    if (!stored) return { created: false, eventId: event.id };
    await tx
      .insert(automationJobs)
      .values({
        id: `automation-event:${event.id}`,
        tenantId: event.tenantId,
        type: "automation_event",
        sourceId: event.id,
        idempotencyKey: event.id,
      })
      .onConflictDoNothing({ target: automationJobs.id });
    return { created: true, eventId: event.id };
  });
}

export async function claimAutomationJobs(
  workerId: string,
  limit = 20,
  leaseSeconds = 60,
) {
  const db = getDatabase();
  return db.execute(sql`
    with candidates as (
      select id from automation_jobs
      where status in ('pending', 'retry')
        and available_at <= now()
        and (lease_expires_at is null or lease_expires_at < now())
      order by priority desc, available_at asc
      for update skip locked
      limit ${limit}
    )
    update automation_jobs as jobs
    set status = 'processing', lock_owner = ${workerId}, locked_at = now(), lease_expires_at = now() + make_interval(secs => ${leaseSeconds}), attempts = attempts + 1, updated_at = now()
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  `);
}

export async function markAutomationJobSucceeded(jobId: string, workerId: string) {
  const db = getDatabase();
  const [job] = await db
    .update(automationJobs)
    .set({
      status: "succeeded",
      lockOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(automationJobs.id, jobId), eq(automationJobs.lockOwner, workerId)))
    .returning();
  return job;
}

export function automationActionKey(
  tenantId: string,
  eventId: string,
  ruleVersionId: string,
  actionIndex: number,
) {
  return actionIdempotencyKey(tenantId, eventId, ruleVersionId, actionIndex);
}
