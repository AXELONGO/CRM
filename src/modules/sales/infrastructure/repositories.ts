import { and, asc, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import {
  withTenantDatabase,
  type TenantTransaction,
} from "@/infrastructure/database/tenant";
import type { Database } from "@/infrastructure/database/client";
import {
  commercialAccounts,
  commercialContacts,
  salesActivities,
  salesDomainEvents,
  salesLeadSources,
  salesLostReasons,
  salesOpportunities,
  salesOpportunityParticipants,
  salesPipelineStages,
  salesPipelines,
  salesStageHistory,
  salesStateHistory,
  tenantMembershipRoles,
  tenantMemberships,
} from "@/infrastructure/database/schema";
import {
  normalizeDisplayName,
  normalizeSearchText,
} from "@/modules/commercial-directory/domain/normalization";
import {
  defaultLeadSources,
  defaultLostReasons,
  defaultPipelineTemplate,
} from "../domain/template";
import {
  assertPricingModel,
  assertStateTransition,
  effectiveProbability,
} from "../domain/state";
import { weightedMinor } from "../domain/money";

type Tx = TenantTransaction;

const sparseStep = 1024;

async function assertSalesMembership(tx: Tx, tenantId: string, membershipId: string) {
  const roles = await tx
    .select({ status: tenantMemberships.status, role: tenantMembershipRoles.role })
    .from(tenantMemberships)
    .innerJoin(
      tenantMembershipRoles,
      eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
    )
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.id, membershipId),
      ),
    );
  if (
    !roles.length ||
    roles[0].status !== "active" ||
    !roles.some((row) => row.role === "sales" || row.role === "tenant_admin")
  )
    throw new Error("SALES_OWNER_INVALID");
}

async function audit(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    fields?: string[];
  },
) {
  const { commercialAuditEvents } = await import("@/infrastructure/database/schema");
  await tx.insert(commercialAuditEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changedFields: input.fields ?? [],
  });
}

export async function provisionDefaultPipeline(
  tx: Tx,
  input: { tenantId: string; actorUserId: string },
) {
  const existing = await tx
    .select({ id: salesPipelines.id })
    .from(salesPipelines)
    .where(
      and(
        eq(salesPipelines.tenantId, input.tenantId),
        eq(salesPipelines.templateKey, defaultPipelineTemplate.key),
        eq(salesPipelines.status, "active"),
      ),
    )
    .limit(1);
  if (existing[0]) return { created: false, pipelineId: existing[0].id };
  const pipelineId = crypto.randomUUID();
  await tx.insert(salesPipelines).values({
    id: pipelineId,
    tenantId: input.tenantId,
    name: defaultPipelineTemplate.name,
    nameNormalized: normalizeSearchText(defaultPipelineTemplate.name),
    status: "active",
    isDefault: true,
    templateKey: defaultPipelineTemplate.key,
    templateVersion: defaultPipelineTemplate.version,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
  await tx.insert(salesPipelineStages).values(
    defaultPipelineTemplate.stages.map((stage, index) => ({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      pipelineId,
      name: stage.name,
      nameNormalized: normalizeSearchText(stage.name),
      color: stage.color,
      position: (index + 1) * sparseStep,
      defaultProbability: stage.probability,
      staleAfterDays: stage.staleAfterDays,
      isInitial: stage.initial,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })),
  );
  await tx.insert(salesLeadSources).values(
    defaultLeadSources.map(([key, name]) => ({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      key,
      name,
      createdByUserId: input.actorUserId,
    })),
  );
  await tx.insert(salesLostReasons).values(
    defaultLostReasons.map(([key, name], index) => ({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      key,
      name,
      position: index,
      createdByUserId: input.actorUserId,
    })),
  );
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.pipeline.provisioned",
    entityType: "pipeline",
    entityId: pipelineId,
  });
  return { created: true, pipelineId };
}

export async function listPipelines(tx: Tx, tenantId: string) {
  const pipelines = await tx
    .select()
    .from(salesPipelines)
    .where(eq(salesPipelines.tenantId, tenantId))
    .orderBy(desc(salesPipelines.isDefault), asc(salesPipelines.name));
  const stages = pipelines.length
    ? await tx
        .select()
        .from(salesPipelineStages)
        .where(
          and(
            eq(salesPipelineStages.tenantId, tenantId),
            inArray(
              salesPipelineStages.pipelineId,
              pipelines.map((pipeline) => pipeline.id),
            ),
          ),
        )
        .orderBy(asc(salesPipelineStages.position))
    : [];
  return pipelines.map((pipeline) => ({
    ...pipeline,
    stages: stages.filter((stage) => stage.pipelineId === pipeline.id),
  }));
}

export async function createPipeline(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    name: string;
    description?: string | null;
    isDefault?: boolean;
  },
) {
  const name = normalizeDisplayName(input.name);
  const [pipeline] = await tx
    .insert(salesPipelines)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name,
      nameNormalized: normalizeSearchText(name),
      description: input.description?.trim() || null,
      isDefault: input.isDefault ?? false,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await tx.insert(salesPipelineStages).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    pipelineId: pipeline.id,
    name: "Nuevo",
    nameNormalized: "nuevo",
    color: "#64748B",
    position: sparseStep,
    defaultProbability: 10,
    staleAfterDays: 2,
    isInitial: true,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.pipeline.created",
    entityType: "pipeline",
    entityId: pipeline.id,
  });
  return pipeline;
}

export async function getPipelineBoard(
  tx: Tx,
  input: { tenantId: string; pipelineId: string; includeArchived?: boolean },
) {
  const stages = await tx
    .select()
    .from(salesPipelineStages)
    .where(
      and(
        eq(salesPipelineStages.tenantId, input.tenantId),
        eq(salesPipelineStages.pipelineId, input.pipelineId),
        input.includeArchived ? undefined : eq(salesPipelineStages.status, "active"),
      ),
    )
    .orderBy(asc(salesPipelineStages.position));
  const opportunities = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.pipelineId, input.pipelineId),
        input.includeArchived
          ? undefined
          : eq(salesOpportunities.recordStatus, "active"),
      ),
    )
    .orderBy(asc(salesOpportunities.position));
  const opportunityIds = opportunities.map((opportunity) => opportunity.id);
  const activities = opportunityIds.length
    ? await tx
        .select()
        .from(salesActivities)
        .where(
          and(
            eq(salesActivities.tenantId, input.tenantId),
            inArray(salesActivities.opportunityId, opportunityIds),
            ne(salesActivities.status, "cancelled"),
          ),
        )
        .orderBy(asc(salesActivities.scheduledAt))
    : [];
  return {
    stages: stages.map((stage) => ({
      ...stage,
      opportunities: opportunities
        .filter((opportunity) => opportunity.stageId === stage.id)
        .map((opportunity) => ({
          ...opportunity,
          nextActivity:
            activities.find(
              (activity) =>
                activity.opportunityId === opportunity.id &&
                activity.status === "planned",
            ) ?? null,
          lastCompletedActivity:
            activities.find(
              (activity) =>
                activity.opportunityId === opportunity.id &&
                activity.status === "completed",
            ) ?? null,
        })),
    })),
  };
}

export async function createOpportunity(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    title: string;
    pipelineId: string;
    stageId?: string;
    primaryContactId?: string | null;
    accountId?: string | null;
    ownerMembershipId: string;
    sourceId?: string | null;
    pricingModel: "fixed_price" | "hourly" | "retainer" | "other";
    currency: string;
    estimatedValueMinor: number;
    hourlyRateMinor?: number | null;
    estimatedHours?: number | null;
    retainerMonthlyMinor?: number | null;
    retainerDurationMonths?: number | null;
    pricingExplanation?: string | null;
    probabilityOverride?: number | null;
    expectedCloseDate?: Date | null;
    summary?: string | null;
  },
) {
  if (!input.primaryContactId && !input.accountId)
    throw new Error("OPPORTUNITY_PARTY_REQUIRED");
  assertPricingModel(input);
  await assertSalesMembership(tx, input.tenantId, input.ownerMembershipId);
  const [stage] = await tx
    .select({ id: salesPipelineStages.id })
    .from(salesPipelineStages)
    .where(
      and(
        eq(salesPipelineStages.tenantId, input.tenantId),
        eq(salesPipelineStages.pipelineId, input.pipelineId),
        input.stageId
          ? eq(salesPipelineStages.id, input.stageId)
          : eq(salesPipelineStages.isInitial, true),
        eq(salesPipelineStages.status, "active"),
      ),
    )
    .limit(1);
  if (!stage) throw new Error("SALES_STAGE_INVALID");
  const positionRows = await tx
    .select({ position: salesOpportunities.position })
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.pipelineId, input.pipelineId),
        eq(salesOpportunities.stageId, stage.id),
      ),
    )
    .orderBy(desc(salesOpportunities.position))
    .limit(1);
  const [opportunity] = await tx
    .insert(salesOpportunities)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      pipelineId: input.pipelineId,
      stageId: stage.id,
      title: normalizeDisplayName(input.title),
      summary: input.summary?.trim() || null,
      primaryContactId: input.primaryContactId ?? null,
      accountId: input.accountId ?? null,
      ownerMembershipId: input.ownerMembershipId,
      sourceId: input.sourceId ?? null,
      pricingModel: input.pricingModel,
      currency: input.currency,
      estimatedValueMinor: input.estimatedValueMinor,
      hourlyRateMinor: input.hourlyRateMinor ?? null,
      estimatedHours: input.estimatedHours ?? null,
      retainerMonthlyMinor: input.retainerMonthlyMinor ?? null,
      retainerDurationMonths: input.retainerDurationMonths ?? null,
      pricingExplanation: input.pricingExplanation?.trim() || null,
      probabilityOverride: input.probabilityOverride ?? null,
      expectedCloseDate: input.expectedCloseDate ?? null,
      position: (positionRows[0]?.position ?? 0) + sparseStep,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await tx.insert(salesStageHistory).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    opportunityId: opportunity.id,
    pipelineId: input.pipelineId,
    fromStageId: null,
    toStageId: stage.id,
    actorUserId: input.actorUserId,
    source: "manual",
    resultingVersion: opportunity.version,
  });
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.opportunity.created",
    entityType: "opportunity",
    entityId: opportunity.id,
  });
  return opportunity;
}

export async function getOpportunity(tx: Tx, tenantId: string, opportunityId: string) {
  const [opportunity] = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, tenantId),
        eq(salesOpportunities.id, opportunityId),
      ),
    )
    .limit(1);
  if (!opportunity) throw new Error("SALES_NOT_FOUND");
  const [stage, activities, stageHistory, stateHistory] = await Promise.all([
    tx
      .select()
      .from(salesPipelineStages)
      .where(
        and(
          eq(salesPipelineStages.tenantId, tenantId),
          eq(salesPipelineStages.id, opportunity.stageId),
        ),
      )
      .limit(1),
    tx
      .select()
      .from(salesActivities)
      .where(
        and(
          eq(salesActivities.tenantId, tenantId),
          eq(salesActivities.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(salesActivities.scheduledAt)),
    tx
      .select()
      .from(salesStageHistory)
      .where(
        and(
          eq(salesStageHistory.tenantId, tenantId),
          eq(salesStageHistory.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(salesStageHistory.createdAt)),
    tx
      .select()
      .from(salesStateHistory)
      .where(
        and(
          eq(salesStateHistory.tenantId, tenantId),
          eq(salesStateHistory.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(salesStateHistory.createdAt)),
  ]);
  return {
    opportunity,
    stage: stage[0] ?? null,
    activities,
    stageHistory,
    stateHistory,
  };
}

export async function moveOpportunity(
  tx: Tx,
  input: {
    tenantId: string;
    opportunityId: string;
    actorUserId: string;
    stageId: string;
    beforeId?: string | null;
    afterId?: string | null;
    version: number;
    source?: "manual" | "kanban";
  },
) {
  const [opportunity] = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
      ),
    )
    .for("update")
    .limit(1);
  if (!opportunity || opportunity.version !== input.version)
    throw new Error("SALES_CONFLICT");
  if (opportunity.state !== "open") throw new Error("OPPORTUNITY_CLOSED");
  const [stage] = await tx
    .select()
    .from(salesPipelineStages)
    .where(
      and(
        eq(salesPipelineStages.tenantId, input.tenantId),
        eq(salesPipelineStages.pipelineId, opportunity.pipelineId),
        eq(salesPipelineStages.id, input.stageId),
        eq(salesPipelineStages.status, "active"),
      ),
    )
    .limit(1);
  if (!stage) throw new Error("SALES_STAGE_INVALID");
  const neighbors = await tx
    .select({ id: salesOpportunities.id, position: salesOpportunities.position })
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.pipelineId, opportunity.pipelineId),
        eq(salesOpportunities.stageId, input.stageId),
        eq(salesOpportunities.state, "open"),
        ne(salesOpportunities.id, opportunity.id),
      ),
    )
    .orderBy(asc(salesOpportunities.position))
    .for("update");
  const before = input.beforeId
    ? neighbors.find((row) => row.id === input.beforeId)
    : undefined;
  const after = input.afterId
    ? neighbors.find((row) => row.id === input.afterId)
    : undefined;
  let position =
    before && after
      ? Math.floor((before.position + after.position) / 2)
      : before
        ? before.position - sparseStep
        : after
          ? after.position + sparseStep
          : (neighbors[neighbors.length - 1]?.position ?? 0) + sparseStep;
  if ((before && after && position === before.position) || position < 1) {
    for (const [index, neighbor] of neighbors.entries())
      await tx
        .update(salesOpportunities)
        .set({ position: (index + 1) * sparseStep })
        .where(
          and(
            eq(salesOpportunities.tenantId, input.tenantId),
            eq(salesOpportunities.id, neighbor.id),
          ),
        );
    position = after
      ? (neighbors.findIndex((row) => row.id === after.id) + 1) * sparseStep -
        Math.floor(sparseStep / 2)
      : (neighbors.length + 1) * sparseStep;
  }
  const [updated] = await tx
    .update(salesOpportunities)
    .set({
      stageId: input.stageId,
      position,
      stageChangedAt:
        opportunity.stageId === input.stageId ? opportunity.stageChangedAt : new Date(),
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${salesOpportunities.version} + 1`,
    })
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
        eq(salesOpportunities.version, input.version),
      ),
    )
    .returning();
  if (!updated) throw new Error("SALES_CONFLICT");
  if (opportunity.stageId !== input.stageId)
    await tx.insert(salesStageHistory).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      pipelineId: opportunity.pipelineId,
      fromStageId: opportunity.stageId,
      toStageId: input.stageId,
      actorUserId: input.actorUserId,
      source: input.source ?? "kanban",
      resultingVersion: updated.version,
    });
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.opportunity.moved",
    entityType: "opportunity",
    entityId: input.opportunityId,
  });
  return updated;
}

export async function closeOpportunity(
  tx: Tx,
  input: {
    tenantId: string;
    opportunityId: string;
    actorUserId: string;
    version: number;
    state: "won" | "lost";
    finalValueMinor?: number | null;
    lostReasonId?: string | null;
    lostExplanation?: string | null;
    cancelPlannedActivities?: boolean;
  },
) {
  const [opportunity] = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
      ),
    )
    .for("update")
    .limit(1);
  if (!opportunity || opportunity.version !== input.version)
    throw new Error("SALES_CONFLICT");
  assertStateTransition(opportunity.state, input.state);
  if (opportunity.state !== "open") throw new Error("OPPORTUNITY_REOPEN_REQUIRED");
  if (input.state === "lost" && !input.lostReasonId)
    throw new Error("LOST_REASON_REQUIRED");
  if (input.lostReasonId) {
    const [reason] = await tx
      .select({ id: salesLostReasons.id })
      .from(salesLostReasons)
      .where(
        and(
          eq(salesLostReasons.tenantId, input.tenantId),
          eq(salesLostReasons.id, input.lostReasonId),
          eq(salesLostReasons.status, "active"),
        ),
      )
      .limit(1);
    if (!reason) throw new Error("LOST_REASON_INVALID");
  }
  if (
    input.lostReasonId &&
    input.lostExplanation &&
    input.lostExplanation.length > 1000
  )
    throw new Error("LOST_EXPLANATION_INVALID");
  const [updated] = await tx
    .update(salesOpportunities)
    .set({
      state: input.state,
      closedAt: new Date(),
      finalValueMinor:
        input.state === "won"
          ? (input.finalValueMinor ?? opportunity.estimatedValueMinor)
          : null,
      lostReasonId: input.state === "lost" ? input.lostReasonId : null,
      lostExplanation:
        input.state === "lost" ? input.lostExplanation?.trim() || null : null,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${salesOpportunities.version} + 1`,
    })
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
        eq(salesOpportunities.version, input.version),
      ),
    )
    .returning();
  if (!updated) throw new Error("SALES_CONFLICT");
  await tx.insert(salesStateHistory).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    fromState: "open",
    toState: input.state,
    actorUserId: input.actorUserId,
    reasonId: input.lostReasonId ?? null,
    explanation: input.lostExplanation?.trim() || null,
    resultingVersion: updated.version,
  });
  if (input.state === "won")
    await tx
      .insert(salesDomainEvents)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        eventType: "OpportunityWon",
        schemaVersion: 1,
        opportunityId: input.opportunityId,
        payload: JSON.stringify({
          eventId: crypto.randomUUID(),
          tenantId: input.tenantId,
          opportunityId: input.opportunityId,
          contactId: opportunity.primaryContactId,
          accountId: opportunity.accountId,
          ownerMembershipId: opportunity.ownerMembershipId,
          pricingModel: opportunity.pricingModel,
          currency: opportunity.currency,
          finalValueMinor: input.finalValueMinor ?? opportunity.estimatedValueMinor,
        }),
      })
      .onConflictDoNothing();
  if (input.cancelPlannedActivities)
    await tx
      .update(salesActivities)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
        updatedByUserId: input.actorUserId,
        version: sql`${salesActivities.version} + 1`,
      })
      .where(
        and(
          eq(salesActivities.tenantId, input.tenantId),
          eq(salesActivities.opportunityId, input.opportunityId),
          eq(salesActivities.status, "planned"),
        ),
      );
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: `sales.opportunity.${input.state}`,
    entityType: "opportunity",
    entityId: input.opportunityId,
  });
  return updated;
}

export async function reopenOpportunity(
  tx: Tx,
  input: {
    tenantId: string;
    opportunityId: string;
    actorUserId: string;
    version: number;
    stageId: string;
  },
) {
  const [opportunity] = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
      ),
    )
    .for("update")
    .limit(1);
  if (!opportunity || opportunity.version !== input.version)
    throw new Error("SALES_CONFLICT");
  assertStateTransition(opportunity.state, "open");
  const [stage] = await tx
    .select({ id: salesPipelineStages.id })
    .from(salesPipelineStages)
    .where(
      and(
        eq(salesPipelineStages.tenantId, input.tenantId),
        eq(salesPipelineStages.pipelineId, opportunity.pipelineId),
        eq(salesPipelineStages.id, input.stageId),
        eq(salesPipelineStages.status, "active"),
      ),
    )
    .limit(1);
  if (!stage) throw new Error("SALES_STAGE_INVALID");
  const [updated] = await tx
    .update(salesOpportunities)
    .set({
      state: "open",
      stageId: input.stageId,
      closedAt: null,
      finalValueMinor: null,
      lostReasonId: null,
      lostExplanation: null,
      stageChangedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${salesOpportunities.version} + 1`,
    })
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, input.opportunityId),
        eq(salesOpportunities.version, input.version),
      ),
    )
    .returning();
  if (!updated) throw new Error("SALES_CONFLICT");
  await tx.insert(salesStateHistory).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    fromState: opportunity.state,
    toState: "open",
    actorUserId: input.actorUserId,
    resultingVersion: updated.version,
  });
  await tx.insert(salesStageHistory).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    pipelineId: opportunity.pipelineId,
    fromStageId: opportunity.stageId,
    toStageId: input.stageId,
    actorUserId: input.actorUserId,
    source: "manual",
    resultingVersion: updated.version,
  });
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.opportunity.reopened",
    entityType: "opportunity",
    entityId: input.opportunityId,
  });
  return updated;
}

export async function createActivity(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    opportunityId: string;
    contactId?: string | null;
    accountId?: string | null;
    type: "call" | "meeting" | "email" | "whatsapp" | "task" | "note";
    status?: "planned" | "completed" | "cancelled";
    title: string;
    description?: string | null;
    scheduledAt?: Date | null;
    ownerMembershipId: string;
    result?: string | null;
  },
) {
  await assertSalesMembership(tx, input.tenantId, input.ownerMembershipId);
  const status = input.type === "note" ? "completed" : (input.status ?? "planned");
  const [activity] = await tx
    .insert(salesActivities)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      contactId: input.contactId ?? null,
      accountId: input.accountId ?? null,
      type: input.type,
      status,
      title: normalizeDisplayName(input.title),
      description: input.description?.trim() || null,
      scheduledAt: input.scheduledAt ?? null,
      ownerMembershipId: input.ownerMembershipId,
      completedAt: status === "completed" ? new Date() : null,
      result: input.result?.trim() || null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "sales.activity.created",
    entityType: "activity",
    entityId: activity.id,
  });
  return activity;
}

export async function updateActivityStatus(
  tx: Tx,
  input: {
    tenantId: string;
    activityId: string;
    actorUserId: string;
    version: number;
    status: "completed" | "cancelled";
    result?: string | null;
  },
) {
  const [activity] = await tx
    .update(salesActivities)
    .set({
      status: input.status,
      completedAt: input.status === "completed" ? new Date() : null,
      result: input.result?.trim() || null,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${salesActivities.version} + 1`,
    })
    .where(
      and(
        eq(salesActivities.tenantId, input.tenantId),
        eq(salesActivities.id, input.activityId),
        eq(salesActivities.version, input.version),
      ),
    )
    .returning();
  if (!activity) throw new Error("SALES_CONFLICT");
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: `sales.activity.${input.status}`,
    entityType: "activity",
    entityId: input.activityId,
  });
  return activity;
}

export async function forecast(
  tx: Tx,
  input: { tenantId: string; pipelineId?: string; from?: Date; to?: Date },
) {
  const rows = await tx
    .select({
      opportunity: salesOpportunities,
      stageProbability: salesPipelineStages.defaultProbability,
    })
    .from(salesOpportunities)
    .innerJoin(
      salesPipelineStages,
      and(
        eq(salesPipelineStages.tenantId, salesOpportunities.tenantId),
        eq(salesPipelineStages.id, salesOpportunities.stageId),
      ),
    )
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.state, "open"),
        eq(salesOpportunities.recordStatus, "active"),
        input.pipelineId
          ? eq(salesOpportunities.pipelineId, input.pipelineId)
          : undefined,
        input.from
          ? sql`${salesOpportunities.expectedCloseDate} >= ${input.from}`
          : undefined,
        input.to
          ? sql`${salesOpportunities.expectedCloseDate} <= ${input.to}`
          : undefined,
      ),
    );
  const result = new Map<
    string,
    {
      currency: string;
      openMinor: number;
      weightedMinor: number;
      count: number;
      retainerMonthlyMinor: number;
    }
  >();
  for (const row of rows) {
    const current = result.get(row.opportunity.currency) ?? {
      currency: row.opportunity.currency,
      openMinor: 0,
      weightedMinor: 0,
      count: 0,
      retainerMonthlyMinor: 0,
    };
    const probability = effectiveProbability(
      row.opportunity.probabilityOverride,
      row.stageProbability,
    );
    current.openMinor += row.opportunity.estimatedValueMinor;
    current.weightedMinor += weightedMinor(
      row.opportunity.estimatedValueMinor,
      probability,
    );
    current.count += 1;
    current.retainerMonthlyMinor += row.opportunity.retainerMonthlyMinor ?? 0;
    result.set(row.opportunity.currency, current);
  }
  return [...result.values()];
}

export async function listSalesSources(tx: Tx, tenantId: string) {
  return tx
    .select()
    .from(salesLeadSources)
    .where(
      and(
        eq(salesLeadSources.tenantId, tenantId),
        eq(salesLeadSources.status, "active"),
      ),
    )
    .orderBy(asc(salesLeadSources.name));
}
export async function listLostReasons(tx: Tx, tenantId: string) {
  return tx
    .select()
    .from(salesLostReasons)
    .where(
      and(
        eq(salesLostReasons.tenantId, tenantId),
        eq(salesLostReasons.status, "active"),
      ),
    )
    .orderBy(asc(salesLostReasons.position));
}

export async function withSalesDatabase<T>(
  db: Database,
  context: Parameters<typeof withTenantDatabase>[1],
  operation: (tx: Tx) => Promise<T>,
) {
  return withTenantDatabase(db, context, operation);
}
