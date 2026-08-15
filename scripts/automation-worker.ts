import { and, eq, sql } from "drizzle-orm";
import { getWorkerDatabase, closeDatabase } from "@/infrastructure/database/client";
import {
  automationActionRuns,
  automationEvents,
  automationJobs,
  automationRuleRuns,
  automationRuleVersions,
  automationRules,
  assignmentQueueMembers,
  inboxConversations,
  internalNotifications,
  resourceReminders,
  salesActivities,
  salesOpportunities,
  tenants,
} from "@/infrastructure/database/schema";
import {
  evaluateAutomation,
  validateAutomationDefinition,
} from "@/modules/automation/domain/engine";
import { getEnvironment } from "@/infrastructure/config/env";

const workerId =
  process.env.WORKER_ID ?? `automation:${process.pid}:${crypto.randomUUID()}`;

type AutomationJob = {
  id: string;
  type: string;
  source_id: string | null;
  attempts: number;
  max_attempts: number;
};

async function claimAutomationJobs(tenantId: string): Promise<AutomationJob[]> {
  const db = getWorkerDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    const environment = getEnvironment();
    const jobs = (await tx.execute(sql`
      with candidates as (
        select id from automation_jobs
        where (status in ('pending', 'retry')
          or (status = 'processing' and lease_expires_at < now()))
          and available_at <= now()
          and tenant_id = ${tenantId}
        order by priority desc, available_at asc
        for update skip locked limit ${environment.AUTOMATION_JOB_BATCH_SIZE}
      )
      update automation_jobs as jobs
      set status = 'processing', lock_owner = ${workerId}, locked_at = now(), lease_expires_at = now() + (${environment.AUTOMATION_JOB_LEASE_SECONDS} * interval '1 second'), attempts = attempts + 1, updated_at = now()
      from candidates where jobs.id = candidates.id
      returning jobs.id, jobs.type, jobs.source_id, jobs.attempts, jobs.max_attempts
    `)) as unknown as AutomationJob[];
    return jobs;
  });
}

async function processClaimedAutomationJob(tenantId: string, job: AutomationJob) {
  const db = getWorkerDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    const environment = getEnvironment();
    const renewed = (await tx.execute(sql`
      update automation_jobs
      set lease_expires_at = now() + (${environment.AUTOMATION_JOB_LEASE_SECONDS} * interval '1 second'), updated_at = now()
      where tenant_id = ${tenantId}
        and id = ${job.id}
        and status = 'processing'
        and lock_owner = ${workerId}
      returning id
    `)) as unknown as Array<{ id: string }>;
    if (!renewed[0]) return;
    try {
      if (job.type !== "automation_event" && job.source_id) {
        const [action] = await tx
          .select()
          .from(automationActionRuns)
          .where(
            and(
              eq(automationActionRuns.tenantId, tenantId),
              eq(automationActionRuns.id, job.source_id),
            ),
          );
        if (!action) throw new Error("AUTOMATION_ACTION_NOT_FOUND");
        const params =
          (action.definition as { params?: Record<string, unknown> }).params ?? {};
        if (job.type === "create_notification" || job.type === "send_email") {
          const membershipId = String(params.membershipId ?? "");
          if (!membershipId) throw new Error("AUTOMATION_MEMBERSHIP_REQUIRED");
          await tx
            .insert(internalNotifications)
            .values({
              id: crypto.randomUUID(),
              tenantId,
              membershipId,
              type: job.type,
              severity:
                params.severity === "critical"
                  ? "critical"
                  : params.severity === "warning"
                    ? "warning"
                    : "info",
              title: String(params.title ?? "Notificación de automatización").slice(
                0,
                200,
              ),
              bodyText: String(params.body ?? params.message ?? "").slice(0, 4000),
              dedupeKey: `automation:${action.id}`,
              resourceType:
                typeof params.resourceType === "string" ? params.resourceType : null,
              resourceId:
                typeof params.resourceId === "string" ? params.resourceId : null,
            })
            .onConflictDoNothing();
        } else if (job.type === "create_reminder") {
          const membershipId = String(params.membershipId ?? "");
          const remindAt = new Date(String(params.remindAt ?? ""));
          if (!membershipId || Number.isNaN(remindAt.getTime()))
            throw new Error("AUTOMATION_REMINDER_INVALID");
          await tx
            .insert(resourceReminders)
            .values({
              id: crypto.randomUUID(),
              tenantId,
              membershipId,
              source: "automation",
              resourceType: String(params.resourceType ?? "automation"),
              resourceId: String(params.resourceId ?? action.id),
              title: String(params.title ?? "Recordatorio").slice(0, 200),
              description:
                typeof params.description === "string"
                  ? params.description.slice(0, 4000)
                  : null,
              remindAt,
              timezone: String(params.timezone ?? "UTC"),
              channel: String(params.channel ?? "in_app"),
              idempotencyKey: `automation:${action.id}`,
              createdByUserId: membershipId,
            })
            .onConflictDoNothing();
        } else if (job.type === "assign_owner") {
          const resourceType = String(params.resourceType ?? "");
          const resourceId = String(params.resourceId ?? "");
          const membershipId = String(params.membershipId ?? "");
          if (
            !membershipId ||
            !resourceId ||
            !["conversation", "opportunity"].includes(resourceType)
          )
            throw new Error("AUTOMATION_ASSIGNMENT_INVALID");
          if (resourceType === "conversation")
            await tx
              .update(inboxConversations)
              .set({
                assignedMembershipId: membershipId,
                updatedAt: new Date(),
                version: sql`${inboxConversations.version} + 1`,
              })
              .where(
                and(
                  eq(inboxConversations.tenantId, tenantId),
                  eq(inboxConversations.id, resourceId),
                ),
              );
          else
            await tx
              .update(salesOpportunities)
              .set({
                ownerMembershipId: membershipId,
                updatedAt: new Date(),
                updatedByUserId: membershipId,
                version: sql`${salesOpportunities.version} + 1`,
              })
              .where(
                and(
                  eq(salesOpportunities.tenantId, tenantId),
                  eq(salesOpportunities.id, resourceId),
                ),
              );
        } else if (job.type === "assign_queue") {
          const resourceType = String(params.resourceType ?? "");
          const resourceId = String(params.resourceId ?? "");
          const [member] = await tx
            .select({ membershipId: assignmentQueueMembers.membershipId })
            .from(assignmentQueueMembers)
            .where(
              and(
                eq(assignmentQueueMembers.tenantId, tenantId),
                eq(assignmentQueueMembers.queueId, String(params.queueId ?? "")),
                eq(assignmentQueueMembers.active, true),
              ),
            )
            .orderBy(assignmentQueueMembers.priority)
            .limit(1);
          if (!member) throw new Error("AUTOMATION_QUEUE_EMPTY");
          if (resourceType === "conversation")
            await tx
              .update(inboxConversations)
              .set({
                assignedMembershipId: member.membershipId,
                updatedAt: new Date(),
                version: sql`${inboxConversations.version} + 1`,
              })
              .where(
                and(
                  eq(inboxConversations.tenantId, tenantId),
                  eq(inboxConversations.id, resourceId),
                ),
              );
          else if (resourceType === "opportunity")
            await tx
              .update(salesOpportunities)
              .set({
                ownerMembershipId: member.membershipId,
                updatedAt: new Date(),
                updatedByUserId: member.membershipId,
                version: sql`${salesOpportunities.version} + 1`,
              })
              .where(
                and(
                  eq(salesOpportunities.tenantId, tenantId),
                  eq(salesOpportunities.id, resourceId),
                ),
              );
          else throw new Error("AUTOMATION_ASSIGNMENT_INVALID");
        } else if (job.type === "create_activity") {
          const opportunityId = String(params.opportunityId ?? "");
          const ownerMembershipId = String(
            params.ownerMembershipId ?? params.membershipId ?? "",
          );
          if (!opportunityId || !ownerMembershipId)
            throw new Error("AUTOMATION_ACTIVITY_INVALID");
          await tx
            .insert(salesActivities)
            .values({
              id: crypto.randomUUID(),
              tenantId,
              opportunityId,
              contactId: null,
              accountId: null,
              type: "task",
              status: "planned",
              title: String(params.title ?? "Actividad automática").slice(0, 200),
              description:
                typeof params.description === "string"
                  ? params.description.slice(0, 5000)
                  : null,
              scheduledAt: params.scheduledAt
                ? new Date(String(params.scheduledAt))
                : new Date(),
              ownerMembershipId,
              createdByUserId: ownerMembershipId,
              updatedByUserId: ownerMembershipId,
            })
            .onConflictDoNothing();
        } else {
          throw new Error("AUTOMATION_ACTION_UNSUPPORTED");
        }
        await tx
          .update(automationActionRuns)
          .set({ status: "succeeded", finishedAt: new Date() })
          .where(
            and(
              eq(automationActionRuns.tenantId, tenantId),
              eq(automationActionRuns.id, action.id),
            ),
          );
        await tx
          .update(automationJobs)
          .set({
            status: "succeeded",
            lockOwner: null,
            leaseExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(automationJobs.tenantId, tenantId),
              eq(automationJobs.id, job.id),
              eq(automationJobs.status, "processing"),
              eq(automationJobs.lockOwner, workerId),
            ),
          );
        return;
      }
      if (job.type !== "automation_event" || !job.source_id)
        throw new Error("AUTOMATION_JOB_INVALID");
      const [event] = await tx
        .select()
        .from(automationEvents)
        .where(
          and(
            eq(automationEvents.id, job.source_id),
            eq(automationEvents.tenantId, tenantId),
          ),
        );
      if (!event) throw new Error("AUTOMATION_EVENT_NOT_FOUND");
      const activeRules = await tx
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.tenantId, tenantId),
            eq(automationRules.status, "active"),
          ),
        );
      for (const rule of activeRules) {
        if (!rule.activeVersionId) continue;
        const [version] = await tx
          .select()
          .from(automationRuleVersions)
          .where(
            and(
              eq(automationRuleVersions.tenantId, tenantId),
              eq(automationRuleVersions.id, rule.activeVersionId),
            ),
          );
        if (!version || version.triggerName !== event.name) continue;
        const result = evaluateAutomation(
          validateAutomationDefinition(version.definition),
          event.payload,
          event.causationDepth,
        );
        const runId = `${event.id}:${version.id}`;
        await tx
          .insert(automationRuleRuns)
          .values({
            id: runId,
            tenantId,
            eventId: event.id,
            ruleVersionId: version.id,
            status: result.matched ? "matched" : "not_matched",
            evaluation: { reason: result.reason },
            correlationId: event.correlationId,
            causationDepth: event.causationDepth,
            actionCount: result.actions.length,
          })
          .onConflictDoNothing();
        for (const [actionIndex, action] of result.actions.entries()) {
          const idempotencyKey = `${tenantId}:${event.id}:${version.id}:${actionIndex}`;
          const [actionRun] = await tx
            .insert(automationActionRuns)
            .values({
              id: idempotencyKey,
              tenantId,
              ruleRunId: runId,
              actionIndex,
              actionType: action.type,
              definition: action,
              status: "running",
              idempotencyKey,
            })
            .onConflictDoNothing()
            .returning();
          if (!actionRun) continue;
          await tx
            .insert(automationJobs)
            .values({
              id: `action:${idempotencyKey}`,
              tenantId,
              type: action.type,
              sourceId: actionRun.id,
              idempotencyKey,
            })
            .onConflictDoNothing();
        }
      }
      await tx
        .update(automationEvents)
        .set({ status: "succeeded", lockOwner: null, leaseExpiresAt: null })
        .where(
          and(
            eq(automationEvents.tenantId, tenantId),
            eq(automationEvents.id, event.id),
          ),
        );
      await tx
        .update(automationJobs)
        .set({
          status: "succeeded",
          lockOwner: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automationJobs.tenantId, tenantId),
            eq(automationJobs.id, job.id),
            eq(automationJobs.status, "processing"),
            eq(automationJobs.lockOwner, workerId),
          ),
        );
    } catch (error) {
      const dead = job.attempts >= job.max_attempts;
      await tx
        .update(automationJobs)
        .set({
          status: dead ? "dead" : "retry",
          availableAt: new Date(
            Date.now() +
              Math.min(300_000, 2 ** job.attempts * 1000) +
              Math.floor(Math.random() * 500),
          ),
          errorCode: error instanceof Error ? error.message : "AUTOMATION_JOB_FAILED",
          lockOwner: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automationJobs.tenantId, tenantId),
            eq(automationJobs.id, job.id),
            eq(automationJobs.status, "processing"),
            eq(automationJobs.lockOwner, workerId),
          ),
        );
    }
  });
}

async function releaseAutomationJobs(tenantId: string, jobs: AutomationJob[]) {
  if (!jobs.length) return;
  const db = getWorkerDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    for (const job of jobs) {
      await tx
        .update(automationJobs)
        .set({
          status: "retry",
          availableAt: new Date(),
          lockOwner: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(automationJobs.tenantId, tenantId),
            eq(automationJobs.id, job.id),
            eq(automationJobs.status, "processing"),
            eq(automationJobs.lockOwner, workerId),
          ),
        );
    }
  });
}

async function processTenant(tenantId: string) {
  const jobs = await claimAutomationJobs(tenantId);
  let index = 0;
  for (; index < jobs.length && !stopping; index += 1) {
    await processClaimedAutomationJob(tenantId, jobs[index]);
  }
  if (index < jobs.length) await releaseAutomationJobs(tenantId, jobs.slice(index));
}

export async function runAutomationWorkerOnce() {
  const db = getWorkerDatabase();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.status, "active"));
  for (const tenant of tenantRows) {
    if (stopping) break;
    await processTenant(tenant.id);
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
    const timer = setTimeout(resolve, getEnvironment().AUTOMATION_WORKER_POLL_MS);
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
    if (process.env.AUTOMATION_WORKER_RUN_ONCE === "true") {
      await runAutomationWorkerOnce();
      return;
    }
    while (!stopping) {
      await runAutomationWorkerOnce();
      if (!stopping) await waitForNextPoll();
    }
  } finally {
    await closeDatabase();
  }
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    console.error(
      "automation-worker failed",
      error instanceof Error ? error.message : "unknown",
    );
    process.exitCode = 1;
  });
}
