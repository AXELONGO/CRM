import { and, asc, eq, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  commercialAccounts,
  portalAccesses,
  portalAccessProjectScopes,
  portalBrandProfiles,
  portalDeliverableDecisions,
  portalDeliverableVersions,
  portalDomains,
  portalInvitations,
  portalMessages,
  portalOutboxEvents,
  portalProjectConversations,
  projectPhases,
  projectTaskChecklistItems,
  projectTasks,
  projects,
} from "@/infrastructure/database/schema";
import { createHash } from "node:crypto";
import { createPortalToken, verifyPortalToken } from "../domain/security";

export async function getPortalBrand(tx: TenantTransaction, tenantId: string) {
  const [brand] = await tx
    .select()
    .from(portalBrandProfiles)
    .where(eq(portalBrandProfiles.tenantId, tenantId))
    .limit(1);
  return brand ?? null;
}

export async function createPortalInvitation(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    accountId: string;
    contactId?: string;
    email: string;
    createdByUserId: string;
    expiresAt: Date;
  },
) {
  const [account] = await tx
    .select({ id: commercialAccounts.id })
    .from(commercialAccounts)
    .where(
      and(
        eq(commercialAccounts.tenantId, input.tenantId),
        eq(commercialAccounts.id, input.accountId),
      ),
    )
    .limit(1);
  if (!account) throw new Error("PORTAL_ACCOUNT_NOT_FOUND");
  const token = createPortalToken();
  const [invitation] = await tx
    .insert(portalInvitations)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      accountId: input.accountId,
      contactId: input.contactId,
      email: input.email.trim().toLowerCase(),
      tokenHash: token.hash,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  await tx.insert(portalOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: "PortalInvitationCreated.v1",
    aggregateId: invitation.id,
    payload: { invitationId: invitation.id, email: invitation.email },
  });
  return { invitation, token: token.token };
}

export async function acceptPortalInvitation(
  tx: TenantTransaction,
  input: { tenantId: string; token: string; userId: string },
) {
  const candidates = await tx
    .select()
    .from(portalInvitations)
    .where(
      and(
        eq(portalInvitations.tenantId, input.tenantId),
        eq(portalInvitations.status, "pending"),
      ),
    )
    .limit(20);
  const invitation = candidates.find((candidate) =>
    verifyPortalToken(input.token, candidate.tokenHash),
  );
  if (!invitation || invitation.expiresAt <= new Date())
    throw new Error("PORTAL_INVITATION_INVALID");
  const [existing] = await tx
    .select()
    .from(portalAccesses)
    .where(
      and(
        eq(portalAccesses.tenantId, invitation.tenantId),
        eq(portalAccesses.userId, input.userId),
        eq(portalAccesses.accountId, invitation.accountId),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const [access] = await tx
    .insert(portalAccesses)
    .values({
      id: crypto.randomUUID(),
      tenantId: invitation.tenantId,
      userId: input.userId,
      accountId: invitation.accountId,
      contactId: invitation.contactId,
      status: "active",
      createdByUserId: invitation.createdByUserId,
      activatedAt: new Date(),
    })
    .returning();
  await tx
    .update(portalInvitations)
    .set({
      status: "accepted",
      acceptedUserId: input.userId,
      acceptedAccessId: access.id,
      acceptedAt: new Date(),
    })
    .where(
      and(
        eq(portalInvitations.tenantId, invitation.tenantId),
        eq(portalInvitations.id, invitation.id),
        eq(portalInvitations.status, "pending"),
      ),
    );
  await syncAccessProjectScopes(tx, {
    tenantId: access.tenantId,
    accessId: access.id,
    accountId: access.accountId,
  });
  return access;
}

export async function syncAccessProjectScopes(
  tx: TenantTransaction,
  input: { tenantId: string; accessId: string; accountId: string },
) {
  const visibleProjects = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.tenantId, input.tenantId),
        eq(projects.customerAccountId, input.accountId),
        sql`${projects.status} in ('active', 'on_hold', 'completed')`,
      ),
    );
  if (!visibleProjects.length) return;
  await tx
    .insert(portalAccessProjectScopes)
    .values(
      visibleProjects.map((project) => ({
        tenantId: input.tenantId,
        accessId: input.accessId,
        projectId: project.id,
      })),
    )
    .onConflictDoNothing();
}

export async function listPortalProjects(
  tx: TenantTransaction,
  input: { tenantId: string; userId: string },
) {
  return tx
    .select({ project: projects })
    .from(projects)
    .innerJoin(
      portalAccesses,
      and(
        eq(portalAccesses.tenantId, projects.tenantId),
        eq(portalAccesses.accountId, projects.customerAccountId!),
        eq(portalAccesses.userId, input.userId),
        eq(portalAccesses.status, "active"),
      ),
    )
    .innerJoin(
      portalAccessProjectScopes,
      and(
        eq(portalAccessProjectScopes.tenantId, projects.tenantId),
        eq(portalAccessProjectScopes.projectId, projects.id),
        eq(portalAccessProjectScopes.accessId, portalAccesses.id),
      ),
    )
    .where(
      and(
        eq(projects.tenantId, input.tenantId),
        sql`${projects.status} in ('active', 'on_hold', 'completed')`,
      ),
    )
    .orderBy(asc(projects.updatedAt));
}

export async function getPortalProjectProgress(
  tx: TenantTransaction,
  input: { tenantId: string; userId: string; projectId: string },
) {
  const visible = await listPortalProjects(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
  });
  const project = visible.find((row) => row.project.id === input.projectId)?.project;
  if (!project) throw new Error("PORTAL_PROJECT_FORBIDDEN");
  const [phases, tasks] = await Promise.all([
    tx
      .select()
      .from(projectPhases)
      .where(
        and(
          eq(projectPhases.tenantId, input.tenantId),
          eq(projectPhases.projectId, input.projectId),
        ),
      )
      .orderBy(asc(projectPhases.position)),
    tx
      .select()
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.tenantId, input.tenantId),
          eq(projectTasks.projectId, input.projectId),
        ),
      )
      .orderBy(asc(projectTasks.position)),
  ]);
  const checklist = await tx
    .select()
    .from(projectTaskChecklistItems)
    .where(
      and(
        eq(projectTaskChecklistItems.tenantId, input.tenantId),
        eq(projectTaskChecklistItems.projectId, input.projectId),
      ),
    )
    .orderBy(asc(projectTaskChecklistItems.position));
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      number: project.number,
      updatedAt: project.updatedAt,
    },
    phases: phases.map((phase) => ({ id: phase.id, name: phase.name })),
    tasks: tasks
      .filter((task) => task.status !== "cancelled")
      .map((task) => ({
        id: task.id,
        phaseId: task.phaseId,
        title: task.title,
        status: task.status,
        priority: task.priority,
      })),
    checklist: checklist.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      text: item.text,
      completed: item.completed,
    })),
    progress: {
      total: tasks.length,
      done: doneTasks,
      percent: tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0,
    },
  };
}

export async function sendPortalMessage(
  tx: TenantTransaction,
  input: { tenantId: string; userId: string; projectId: string; body: string },
) {
  const visible = await listPortalProjects(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
  });
  if (!visible.some((row) => row.project.id === input.projectId))
    throw new Error("PORTAL_PROJECT_FORBIDDEN");
  const [conversation] = await tx
    .insert(portalProjectConversations)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
    })
    .onConflictDoNothing()
    .returning();
  const [existingConversation] = conversation
    ? [conversation]
    : await tx
        .select()
        .from(portalProjectConversations)
        .where(
          and(
            eq(portalProjectConversations.tenantId, input.tenantId),
            eq(portalProjectConversations.projectId, input.projectId),
          ),
        )
        .limit(1);
  const [message] = await tx
    .insert(portalMessages)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      conversationId: existingConversation.id,
      authorUserId: input.userId,
      body: input.body.trim(),
    })
    .returning();
  return message;
}

export async function decideDeliverable(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    accessId: string;
    versionId: string;
    decision: "approved" | "changes_requested";
    comment?: string;
  },
) {
  const [version] = await tx
    .select({
      version: portalDeliverableVersions,
      deliverable: portalDeliverableVersions.deliverableId,
    })
    .from(portalDeliverableVersions)
    .where(
      and(
        eq(portalDeliverableVersions.tenantId, input.tenantId),
        eq(portalDeliverableVersions.id, input.versionId),
      ),
    )
    .limit(1);
  if (!version) throw new Error("PORTAL_DELIVERABLE_NOT_FOUND");
  const [decision] = await tx
    .insert(portalDeliverableDecisions)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      deliverableVersionId: input.versionId,
      accessId: input.accessId,
      decision: input.decision,
      comment: input.comment,
      decisionHash: createHash("sha256")
        .update(`${input.versionId}:${input.decision}:${input.comment ?? ""}`)
        .digest("hex"),
    })
    .onConflictDoNothing()
    .returning();
  if (!decision) throw new Error("PORTAL_DECISION_ALREADY_EXISTS");
  return decision;
}
