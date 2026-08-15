import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  agreementVersions,
  agreements,
  depositRequirements,
  receivablePlans,
  portalAccesses,
  portalAccessProjectScopes,
  projectActivationApprovals,
  projectActivations,
  projectActivationPolicies,
  projectNumberSequences,
  projectOutboxEvents,
  projectPhases,
  projectPlanVersions,
  projects,
  projectTaskChecklistItems,
  projectTasks,
  projectTemplateSelectionRules,
  projectTemplateVersions,
  projectTemplates,
  quoteVersions,
  quotes,
  salesDomainEvents,
  salesOpportunities,
} from "@/infrastructure/database/schema";
import { createHash } from "node:crypto";
import { activationReadiness, type GateResult } from "../domain/activation";
import {
  evaluateTemplateRules,
  normalizeTemplateContent,
  templateContentHash,
  type ProjectTemplateContent,
} from "../domain/templates";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function outbox(
  tx: TenantTransaction,
  tenantId: string,
  name: string,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  await tx
    .insert(projectOutboxEvents)
    .values({ id: crypto.randomUUID(), tenantId, name, aggregateId, payload });
}

export async function listProjects(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(projects)
    .where(eq(projects.tenantId, tenantId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(
  tx: TenantTransaction,
  tenantId: string,
  projectId: string,
) {
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)))
    .limit(1);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const phases = await tx
    .select()
    .from(projectPhases)
    .where(
      and(eq(projectPhases.tenantId, tenantId), eq(projectPhases.projectId, projectId)),
    )
    .orderBy(asc(projectPhases.position));
  const tasks = await tx
    .select()
    .from(projectTasks)
    .where(
      and(eq(projectTasks.tenantId, tenantId), eq(projectTasks.projectId, projectId)),
    )
    .orderBy(asc(projectTasks.position));
  const checklistItems = await tx
    .select()
    .from(projectTaskChecklistItems)
    .where(
      and(
        eq(projectTaskChecklistItems.tenantId, tenantId),
        eq(projectTaskChecklistItems.projectId, projectId),
      ),
    )
    .orderBy(asc(projectTaskChecklistItems.position));
  return { project, phases, tasks, checklistItems };
}

export async function listTemplates(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(projectTemplates)
    .where(eq(projectTemplates.tenantId, tenantId))
    .orderBy(asc(projectTemplates.name));
}

export async function createTemplate(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    name: string;
    activationPolicyId: string;
    commercialModels: string[];
  },
) {
  const [template] = await tx
    .insert(projectTemplates)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name: input.name.trim(),
      activationPolicyId: input.activationPolicyId,
      commercialModels: input.commercialModels,
      createdByMembershipId: input.membershipId,
    })
    .returning();
  return template;
}

export async function publishTemplate(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    templateId: string;
    membershipId: string;
    content: ProjectTemplateContent;
  },
) {
  const content = normalizeTemplateContent(input.content);
  const [template] = await tx
    .select()
    .from(projectTemplates)
    .where(
      and(
        eq(projectTemplates.tenantId, input.tenantId),
        eq(projectTemplates.id, input.templateId),
      ),
    )
    .for("update")
    .limit(1);
  if (!template) throw new Error("PROJECT_TEMPLATE_NOT_FOUND");
  const [latest] = await tx
    .select({ versionNumber: projectTemplateVersions.versionNumber })
    .from(projectTemplateVersions)
    .where(
      and(
        eq(projectTemplateVersions.tenantId, input.tenantId),
        eq(projectTemplateVersions.templateId, input.templateId),
      ),
    )
    .orderBy(desc(projectTemplateVersions.versionNumber))
    .limit(1);
  const [version] = await tx
    .insert(projectTemplateVersions)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      templateId: input.templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      content,
      contentHash: templateContentHash(content),
      publishedAt: new Date(),
      publishedByMembershipId: input.membershipId,
    })
    .returning();
  await tx
    .update(projectTemplates)
    .set({
      status: "published",
      currentPublishedVersionId: version.id,
      updatedAt: new Date(),
      version: sql`${projectTemplates.version} + 1`,
    })
    .where(
      and(
        eq(projectTemplates.tenantId, input.tenantId),
        eq(projectTemplates.id, input.templateId),
      ),
    );
  await outbox(tx, input.tenantId, "ProjectTemplatePublished.v1", template.id, {
    templateId: template.id,
    templateVersionId: version.id,
  });
  return version;
}

export async function selectTemplateForProject(
  tx: TenantTransaction,
  input: { tenantId: string; projectId: string; templateId: string },
) {
  const [template] = await tx
    .select({ template: projectTemplates, version: projectTemplateVersions })
    .from(projectTemplates)
    .innerJoin(
      projectTemplateVersions,
      and(
        eq(projectTemplateVersions.tenantId, projectTemplates.tenantId),
        eq(projectTemplateVersions.id, projectTemplates.currentPublishedVersionId!),
      ),
    )
    .where(
      and(
        eq(projectTemplates.tenantId, input.tenantId),
        eq(projectTemplates.id, input.templateId),
        eq(projectTemplates.status, "published"),
      ),
    )
    .limit(1);
  if (!template) throw new Error("PROJECT_TEMPLATE_NOT_PUBLISHED");
  const [project] = await tx
    .update(projects)
    .set({
      templateVersionId: template.version.id,
      preparationStatus: "ready_for_planning",
      updatedAt: new Date(),
      version: sql`${projects.version} + 1`,
    })
    .where(
      and(
        eq(projects.tenantId, input.tenantId),
        eq(projects.id, input.projectId),
        eq(projects.status, "draft"),
      ),
    )
    .returning();
  if (!project) throw new Error("PROJECT_NOT_EDITABLE");
  return { project, templateVersion: template.version };
}

export async function consumeOpportunityWon(
  tx: TenantTransaction,
  input: { tenantId: string; eventId: string },
) {
  const [event] = await tx
    .select()
    .from(salesDomainEvents)
    .where(
      and(
        eq(salesDomainEvents.tenantId, input.tenantId),
        eq(salesDomainEvents.id, input.eventId),
        eq(salesDomainEvents.eventType, "OpportunityWon"),
      ),
    )
    .limit(1);
  if (!event) throw new Error("PROJECT_WON_EVENT_NOT_FOUND");
  const [opportunity] = await tx
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.tenantId, input.tenantId),
        eq(salesOpportunities.id, event.opportunityId),
        eq(salesOpportunities.state, "won"),
      ),
    )
    .limit(1);
  if (!opportunity) throw new Error("PROJECT_OPPORTUNITY_NOT_WON");
  const [existing] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.tenantId, input.tenantId),
        eq(projects.opportunityId, opportunity.id),
      ),
    )
    .limit(1);
  if (existing) return { projectId: existing.id, repeated: true };
  const [policy] = await tx
    .select()
    .from(projectActivationPolicies)
    .where(
      and(
        eq(projectActivationPolicies.tenantId, input.tenantId),
        eq(projectActivationPolicies.status, "published"),
      ),
    )
    .orderBy(asc(projectActivationPolicies.createdAt))
    .limit(1);
  if (!policy) {
    const [createdPolicy] = await tx
      .insert(projectActivationPolicies)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        name: "Política piloto de cuatro gates",
      })
      .onConflictDoNothing()
      .returning();
    if (createdPolicy) {
      return consumeOpportunityWon(tx, input);
    }
  }
  if (!policy) throw new Error("PROJECT_ACTIVATION_POLICY_MISSING");
  const [scope] = await tx
    .select({ quote: quotes, version: quoteVersions })
    .from(quotes)
    .innerJoin(
      quoteVersions,
      and(
        eq(quoteVersions.tenantId, quotes.tenantId),
        eq(quoteVersions.quoteId, quotes.id),
      ),
    )
    .where(
      and(
        eq(quotes.tenantId, input.tenantId),
        eq(quotes.opportunityId, opportunity.id),
        eq(quotes.status, "accepted"),
      ),
    )
    .orderBy(desc(quoteVersions.versionNumber))
    .limit(1);
  const rules = await tx
    .select()
    .from(projectTemplateSelectionRules)
    .where(eq(projectTemplateSelectionRules.tenantId, input.tenantId));
  const selection = evaluateTemplateRules(rules, opportunity.pricingModel);
  const [project] = await tx
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      opportunityId: opportunity.id,
      quoteId: scope?.quote.id,
      quoteVersionId: scope?.version.id,
      acceptedScopeHash: scope?.version.snapshotHash,
      customerAccountId: opportunity.accountId,
      primaryContactId: opportunity.primaryContactId,
      originOwnerMembershipId: opportunity.ownerMembershipId,
      name: opportunity.title,
      summary: opportunity.summary,
      commercialModel: opportunity.pricingModel,
      currency: opportunity.currency,
      preparationStatus: scope
        ? selection.status === "selected"
          ? "ready_for_planning"
          : "awaiting_template"
        : "awaiting_commercial_scope",
      templateVersionId: null,
      activationPolicyVersionId: policy.id,
      createdByMembershipId: opportunity.ownerMembershipId,
    })
    .returning();
  await outbox(tx, input.tenantId, "ProjectDraftCreated.v1", project.id, {
    projectId: project.id,
    opportunityId: opportunity.id,
    selectionStatus: selection.status,
  });
  return { projectId: project.id, repeated: false };
}

export async function reconcileProjectCommercialScope(
  tx: TenantTransaction,
  input: {
    sessionHash: string;
    quoteVersionId: string;
    snapshotHash: string;
  },
) {
  const rows = await tx.execute(
    sql`select public.reconcile_project_commercial_scope(${input.sessionHash}, ${input.quoteVersionId}, ${input.snapshotHash}) as project_id`,
  );
  const projectId = (rows[0] as { project_id: string | null } | undefined)
    ?.project_id;
  return { projectId: projectId ?? null };
}

export async function enqueueOpportunityWonJobs(
  tx: TenantTransaction,
  tenantId: string,
) {
  const events = await tx
    .select({ id: salesDomainEvents.id })
    .from(salesDomainEvents)
    .where(
      and(
        eq(salesDomainEvents.tenantId, tenantId),
        eq(salesDomainEvents.eventType, "OpportunityWon"),
      ),
    );
  const { integrationJobs } = await import("@/infrastructure/database/schema");
  for (const event of events) {
    await tx
      .insert(integrationJobs)
      .values({
        id: `project-won:${event.id}`,
        tenantId,
        type: "create_project_draft_from_won",
        idempotencyKey: `project-won:${event.id}`,
      })
      .onConflictDoNothing();
  }
}

export async function requestActivation(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    projectId: string;
    membershipId: string;
    idempotencyKey: string;
  },
) {
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, input.projectId)))
    .for("update")
    .limit(1);
  if (!project || !project.templateVersionId)
    throw new Error("PROJECT_TEMPLATE_REQUIRED");
  const [templateVersion] = await tx
    .select()
    .from(projectTemplateVersions)
    .where(
      and(
        eq(projectTemplateVersions.tenantId, input.tenantId),
        eq(projectTemplateVersions.id, project.templateVersionId),
      ),
    )
    .limit(1);
  const [policy] = await tx
    .select()
    .from(projectActivationPolicies)
    .where(
      and(
        eq(projectActivationPolicies.tenantId, input.tenantId),
        eq(projectActivationPolicies.id, project.activationPolicyVersionId!),
      ),
    )
    .limit(1);
  if (!templateVersion || !policy) throw new Error("PROJECT_PLAN_SOURCE_MISSING");
  const content = normalizeTemplateContent(
    templateVersion.content as ProjectTemplateContent,
  );
  const planSnapshot = {
    project: { id: project.id, name: project.name },
    templateVersionId: templateVersion.id,
    phases: content.phases,
    tasks: content.tasks,
    policy,
  };
  const planHash = digest(planSnapshot);
  const [plan] = await tx
    .insert(projectPlanVersions)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      projectId: project.id,
      versionNumber: project.version,
      templateVersionId: templateVersion.id,
      commercialOriginSnapshot: {
        quoteId: project.quoteId,
        quoteVersionId: project.quoteVersionId,
        acceptedScopeHash: project.acceptedScopeHash,
      },
      projectSnapshot: planSnapshot.project,
      phases: content.phases,
      tasks: content.tasks,
      activationPolicySnapshot: policy,
      contentHash: planHash,
      createdByMembershipId: input.membershipId,
    })
    .returning();
  const [approval] = await tx
    .insert(projectActivationApprovals)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      projectId: project.id,
      planVersionId: plan.id,
      planHash,
      requestedByMembershipId: input.membershipId,
    })
    .returning();
  await tx
    .update(projects)
    .set({
      currentPlanVersionId: plan.id,
      status: "activation_pending",
      preparationStatus: "activation_pending",
      updatedAt: new Date(),
      version: sql`${projects.version} + 1`,
    })
    .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, project.id)));
  await outbox(tx, input.tenantId, "ProjectActivationRequested.v1", project.id, {
    projectId: project.id,
    planVersionId: plan.id,
    approvalId: approval.id,
    planHash,
  });
  return { plan, approval };
}

export async function evaluateGates(
  tx: TenantTransaction,
  input: { tenantId: string; projectId: string; planVersionId: string },
) {
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, input.projectId)))
    .limit(1);
  const [plan] = await tx
    .select()
    .from(projectPlanVersions)
    .where(
      and(
        eq(projectPlanVersions.tenantId, input.tenantId),
        eq(projectPlanVersions.id, input.planVersionId),
      ),
    )
    .limit(1);
  const [policy] = await tx
    .select()
    .from(projectActivationPolicies)
    .where(
      and(
        eq(projectActivationPolicies.tenantId, input.tenantId),
        eq(projectActivationPolicies.id, project?.activationPolicyVersionId!),
      ),
    )
    .limit(1);
  if (!project || !plan || !policy) throw new Error("PROJECT_GATE_SOURCE_MISSING");
  const [quote] = project.quoteVersionId
    ? await tx
        .select()
        .from(quoteVersions)
        .where(
          and(
            eq(quoteVersions.tenantId, input.tenantId),
            eq(quoteVersions.id, project.quoteVersionId),
          ),
        )
        .limit(1)
    : [];
  const [quoteRecord] = project.quoteId
    ? await tx
        .select()
        .from(quotes)
        .where(
          and(
            eq(quotes.tenantId, input.tenantId),
            eq(quotes.id, project.quoteId),
            eq(quotes.status, "accepted"),
          ),
        )
        .limit(1)
    : [];
  const [receivable] = project.quoteVersionId
    ? await tx
        .select({ plan: receivablePlans, deposit: depositRequirements })
        .from(receivablePlans)
        .leftJoin(
          agreements,
          and(
            eq(agreements.tenantId, receivablePlans.tenantId),
            eq(agreements.id, receivablePlans.sourceId),
            eq(receivablePlans.sourceKind, "executed_agreement_version"),
          ),
        )
        .innerJoin(
          depositRequirements,
          and(
            eq(depositRequirements.tenantId, receivablePlans.tenantId),
            eq(depositRequirements.planId, receivablePlans.id),
          ),
        )
        .where(
          and(
            eq(receivablePlans.tenantId, input.tenantId),
            or(
              eq(receivablePlans.sourceVersionId, project.quoteVersionId),
              eq(agreements.quoteVersionId, project.quoteVersionId),
            ),
          ),
        )
        .orderBy(desc(receivablePlans.createdAt))
        .limit(1)
    : [];
  const [agreement] = await tx
    .select({ agreement: agreements, version: agreementVersions })
    .from(agreements)
    .leftJoin(
      agreementVersions,
      and(
        eq(agreementVersions.tenantId, agreements.tenantId),
        eq(agreementVersions.id, agreements.executedVersionId!),
      ),
    )
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.opportunityId, project.opportunityId),
        eq(agreements.status, "executed"),
      ),
    )
    .limit(1);
  const [approval] = await tx
    .select()
    .from(projectActivationApprovals)
    .where(
      and(
        eq(projectActivationApprovals.tenantId, input.tenantId),
        eq(projectActivationApprovals.planVersionId, input.planVersionId),
        eq(projectActivationApprovals.status, "approved"),
      ),
    )
    .limit(1);
  const gates: GateResult[] = [
    {
      type: "accepted_quote",
      status:
        policy.requireAcceptedQuote &&
        quote &&
        quoteRecord &&
        quote.snapshotHash === project.acceptedScopeHash
          ? "satisfied"
          : "failed",
      reasonCode: quoteRecord ? "QUOTE_ACCEPTED" : "QUOTE_MISSING",
      humanMessage: quoteRecord
        ? "Cotización aceptada y hash coincidente."
        : "Falta una cotización aceptada compatible.",
    },
    {
      type: "deposit",
      status:
        !policy.requireSatisfiedDeposit || receivable?.deposit.status === "not_required"
          ? "satisfied"
          : receivable?.deposit.status === "satisfied"
            ? "satisfied"
            : receivable
              ? "pending"
              : "unavailable",
      reasonCode: receivable?.deposit.status ?? "DEPOSIT_PLAN_MISSING",
      humanMessage:
        !policy.requireSatisfiedDeposit || receivable?.deposit.status === "not_required"
          ? "Anticipo no requerido por la política."
          : receivable?.deposit.status === "satisfied"
            ? "Anticipo satisfecho."
            : receivable
              ? "El anticipo aún no está satisfecho."
              : "No se encontró el plan de cobro compatible.",
    },
    {
      type: "internal_approval",
      status:
        policy.requireInternalApproval && approval
          ? "satisfied"
          : policy.requireInternalApproval
            ? "pending"
            : "satisfied",
      reasonCode: approval ? "APPROVED" : "APPROVAL_PENDING",
      humanMessage: approval
        ? "Aprobación interna vigente."
        : "Falta aprobación interna para este hash.",
    },
    {
      type: "executed_agreement",
      status:
        policy.requireExecutedAgreement && agreement?.version
          ? "satisfied"
          : policy.requireExecutedAgreement
            ? "pending"
            : "satisfied",
      reasonCode: agreement?.version ? "AGREEMENT_EXECUTED" : "AGREEMENT_PENDING",
      humanMessage: agreement?.version
        ? "Contrato ejecutado."
        : "Falta contrato o propuesta ejecutada.",
    },
  ];
  return { status: activationReadiness(gates), planHash: plan.contentHash, gates };
}

export async function decideApproval(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    approvalId: string;
    reviewerMembershipId: string;
    decision: "approved" | "rejected";
    reason?: string;
  },
) {
  const [approval] = await tx
    .select()
    .from(projectActivationApprovals)
    .where(
      and(
        eq(projectActivationApprovals.tenantId, input.tenantId),
        eq(projectActivationApprovals.id, input.approvalId),
      ),
    )
    .for("update")
    .limit(1);
  if (!approval || approval.status !== "pending")
    throw new Error("PROJECT_APPROVAL_NOT_PENDING");
  if (approval.requestedByMembershipId === input.reviewerMembershipId)
    throw new Error("PROJECT_APPROVAL_SELF_REVIEW");
  if (input.decision === "rejected" && !input.reason?.trim())
    throw new Error("PROJECT_APPROVAL_REASON_REQUIRED");
  const [updated] = await tx
    .update(projectActivationApprovals)
    .set({
      status: input.decision,
      decidedByMembershipId: input.reviewerMembershipId,
      decisionReason: input.reason,
      decidedAt: new Date(),
      version: sql`${projectActivationApprovals.version} + 1`,
    })
    .where(
      and(
        eq(projectActivationApprovals.tenantId, input.tenantId),
        eq(projectActivationApprovals.id, approval.id),
        eq(projectActivationApprovals.status, "pending"),
      ),
    )
    .returning();
  await outbox(
    tx,
    input.tenantId,
    "ProjectInternalApprovalDecided.v1",
    approval.projectId,
    { approvalId: approval.id, decision: input.decision },
  );
  return updated;
}

export async function activateProject(
  tx: TenantTransaction,
  input: { tenantId: string; projectId: string; membershipId: string },
) {
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, input.projectId)))
    .for("update")
    .limit(1);
  if (
    !project ||
    project.status !== "activation_pending" ||
    !project.currentPlanVersionId
  )
    throw new Error("PROJECT_NOT_ACTIVATION_PENDING");
  const readiness = await evaluateGates(tx, {
    tenantId: input.tenantId,
    projectId: project.id,
    planVersionId: project.currentPlanVersionId,
  });
  if (readiness.status !== "ready") throw new Error("PROJECT_GATES_NOT_SATISFIED");
  const year = new Date().getUTCFullYear();
  const [sequence] = await tx
    .insert(projectNumberSequences)
    .values({ tenantId: input.tenantId, year, nextValue: 2 })
    .onConflictDoUpdate({
      target: [projectNumberSequences.tenantId, projectNumberSequences.year],
      set: { nextValue: sql`${projectNumberSequences.nextValue} + 1` },
    })
    .returning({ nextValue: projectNumberSequences.nextValue });
  const number = `PRJ-${year}-${String((sequence?.nextValue ?? 2) - 1).padStart(4, "0")}`;
  const [plan] = await tx
    .select()
    .from(projectPlanVersions)
    .where(
      and(
        eq(projectPlanVersions.tenantId, input.tenantId),
        eq(projectPlanVersions.id, project.currentPlanVersionId),
      ),
    )
    .limit(1);
  const content = plan?.tasks as ProjectTemplateContent["tasks"] | undefined;
  const phases = (plan?.phases as ProjectTemplateContent["phases"] | undefined) ?? [];
  const phaseRows = await tx
    .insert(projectPhases)
    .values(
      phases.map((phase) => ({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        projectId: project.id,
        templateKey: phase.key,
        name: phase.name,
        position: phase.order,
      })),
    )
    .returning();
  const phaseMap = new Map(phaseRows.map((phase) => [phase.templateKey, phase.id]));
  if (content?.length)
    for (const task of content) {
      const taskId = crypto.randomUUID();
      await tx.insert(projectTasks).values({
        id: taskId,
        tenantId: input.tenantId,
        projectId: project.id,
        phaseId: phaseMap.get(task.phaseKey)!,
        templateKey: task.key,
        title: task.title,
        description: task.description,
        status: "todo" as const,
        priority: task.priority ?? "normal",
        reviewRequired: task.reviewRequired ?? false,
        createdByMembershipId: input.membershipId,
      });
      for (const [index, text] of (task.checklist ?? []).entries()) {
        await tx.insert(projectTaskChecklistItems).values({
          id: crypto.randomUUID(),
          tenantId: input.tenantId,
          projectId: project.id,
          taskId,
          text,
          position: index + 1,
          required: true,
          completed: false,
        });
      }
    }
  const [activation] = await tx
    .insert(projectActivations)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      projectId: project.id,
      planVersionId: project.currentPlanVersionId,
      projectNumber: number,
      gateEvidence: { gates: readiness.gates },
      activatedByMembershipId: input.membershipId,
      evidenceDigest: digest(readiness.gates),
    })
    .returning();
  await tx
    .update(projects)
    .set({
      number,
      status: "active",
      actualStartAt: new Date(),
      updatedAt: new Date(),
      version: sql`${projects.version} + 1`,
    })
    .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, project.id)));
  await outbox(tx, input.tenantId, "ProjectActivated.v1", project.id, {
    projectId: project.id,
    projectNumber: number,
    activationId: activation.id,
  });
  await syncPortalProjectScopes(tx, input.tenantId, project);
  return { project: { ...project, number, status: "active" }, activation };
}

async function syncPortalProjectScopes(
  tx: TenantTransaction,
  tenantId: string,
  project: { id: string; customerAccountId: string | null },
) {
  if (!project.customerAccountId) return;
  const accesses = await tx
    .select({ id: portalAccesses.id })
    .from(portalAccesses)
    .where(
      and(
        eq(portalAccesses.tenantId, tenantId),
        eq(portalAccesses.accountId, project.customerAccountId),
        eq(portalAccesses.status, "active"),
      ),
    );
  if (!accesses.length) return;
  await tx
    .insert(portalAccessProjectScopes)
    .values(
      accesses.map((access) => ({
        tenantId,
        accessId: access.id,
        projectId: project.id,
      })),
    )
    .onConflictDoNothing();
}

const taskStatuses = [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
  "cancelled",
] as const;
type TaskStatus = (typeof taskStatuses)[number];

export async function updateProjectTaskStatus(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    projectId: string;
    taskId: string;
    status: TaskStatus;
    membershipId: string;
  },
) {
  const [task] = await tx
    .select()
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.tenantId, input.tenantId),
        eq(projectTasks.projectId, input.projectId),
        eq(projectTasks.id, input.taskId),
      ),
    )
    .limit(1);
  if (!task) throw new Error("PROJECT_TASK_NOT_FOUND");
  if (task.status === "done" && input.status !== "done")
    throw new Error("PROJECT_TASK_CLOSED");
  if (task.status === "cancelled" && input.status !== "cancelled")
    throw new Error("PROJECT_TASK_CLOSED");
  const [updated] = await tx
    .update(projectTasks)
    .set({
      status: input.status,
      updatedAt: new Date(),
      version: sql`${projectTasks.version} + 1`,
    })
    .where(
      and(
        eq(projectTasks.tenantId, input.tenantId),
        eq(projectTasks.id, input.taskId),
      ),
    )
    .returning();
  return { task: updated };
}

export async function setProjectTaskBlockedReason(
  tx: TenantTransaction,
  input: { tenantId: string; projectId: string; taskId: string; reason: string },
) {
  const [task] = await tx
    .select()
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.tenantId, input.tenantId),
        eq(projectTasks.projectId, input.projectId),
        eq(projectTasks.id, input.taskId),
      ),
    )
    .limit(1);
  if (!task) throw new Error("PROJECT_TASK_NOT_FOUND");
  const [updated] = await tx
    .update(projectTasks)
    .set({
      blockedReason: input.reason.trim() || null,
      updatedAt: new Date(),
      version: sql`${projectTasks.version} + 1`,
    })
    .where(and(eq(projectTasks.tenantId, input.tenantId), eq(projectTasks.id, input.taskId)))
    .returning();
  return { task: updated };
}

export async function toggleProjectTaskChecklist(
  tx: TenantTransaction,
  input: { tenantId: string; projectId: string; itemId: string },
) {
  const [item] = await tx
    .select()
    .from(projectTaskChecklistItems)
    .where(
      and(
        eq(projectTaskChecklistItems.tenantId, input.tenantId),
        eq(projectTaskChecklistItems.projectId, input.projectId),
        eq(projectTaskChecklistItems.id, input.itemId),
      ),
    )
    .limit(1);
  if (!item) throw new Error("PROJECT_CHECKLIST_NOT_FOUND");
  const [updated] = await tx
    .update(projectTaskChecklistItems)
    .set({ completed: !item.completed })
    .where(
      and(
        eq(projectTaskChecklistItems.tenantId, input.tenantId),
        eq(projectTaskChecklistItems.id, input.itemId),
      ),
    )
    .returning();
  return { item: updated };
}
