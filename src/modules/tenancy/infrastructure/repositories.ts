import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  platformAdministrators,
  securityAuditEvents,
  tenantInvitationRoles,
  tenantInvitations,
  tenantMembershipRoles,
  tenantMemberships,
  tenants,
  user,
} from "@/infrastructure/database/schema";
import type { TenantRole } from "@/modules/tenancy/domain/policy";
import {
  areRolesCompatible,
  normalizeInvitationEmail,
  validateTenantSlug,
} from "@/modules/tenancy/domain/policy";
import {
  createInvitationToken,
  hashInvitationToken,
} from "@/modules/tenancy/domain/invitation-token";
import { provisionDefaultPipeline } from "@/modules/sales/infrastructure/repositories";
import {
  withTenantIdDatabase,
  withUserDatabase,
  type TenantTransaction,
} from "@/infrastructure/database/tenant";

export type AuditEventInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  result: "success" | "denied";
  metadata?: Record<string, unknown>;
};

type AuditExecutor = Pick<Database, "insert">;

async function withInvitationLookup<T>(
  db: Database,
  tokenHash: string,
  email: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.invitation_token_hash', ${tokenHash}, true)`,
    );
    await tx.execute(sql`select set_config('app.invitation_email', ${email}, true)`);
    return operation(tx);
  });
}

export async function appendAuditEvent(
  executor: AuditExecutor,
  event: AuditEventInput,
): Promise<void> {
  await executor.insert(securityAuditEvents).values({
    id: crypto.randomUUID(),
    tenantId: event.tenantId ?? null,
    actorUserId: event.actorUserId ?? null,
    eventType: event.eventType,
    targetType: event.targetType,
    targetId: event.targetId,
    result: event.result,
    metadata: event.metadata ?? {},
  });
}

export async function isPlatformAdministrator(
  db: Database,
  userId: string,
): Promise<boolean> {
  const [administrator] = await db
    .select({ userId: platformAdministrators.userId })
    .from(platformAdministrators)
    .where(eq(platformAdministrators.userId, userId))
    .limit(1);
  return Boolean(administrator);
}

export async function findUserByNormalizedEmail(db: Database, email: string) {
  const [found] = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, normalizeInvitationEmail(email)))
    .limit(1);
  return found ?? null;
}

export async function listUserMemberships(db: Database, userId: string) {
  const rows = await withUserDatabase(db, userId, (tx) =>
    tx
      .select({
        membershipId: tenantMemberships.id,
        membershipStatus: tenantMemberships.status,
        tenantId: tenants.id,
        displayName: tenants.displayName,
        slug: tenants.slug,
        tenantStatus: tenants.status,
        role: tenantMembershipRoles.role,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(
        tenantMembershipRoles,
        eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
      )
      .where(eq(tenantMemberships.userId, userId))
      .orderBy(asc(tenants.displayName), asc(tenantMembershipRoles.role)),
  );

  const grouped = new Map<
    string,
    {
      membershipId: string;
      membershipStatus: (typeof rows)[number]["membershipStatus"];
      tenantId: string;
      displayName: string;
      slug: string;
      tenantStatus: (typeof rows)[number]["tenantStatus"];
      roles: TenantRole[];
    }
  >();

  for (const row of rows) {
    const current = grouped.get(row.membershipId) ?? {
      membershipId: row.membershipId,
      membershipStatus: row.membershipStatus,
      tenantId: row.tenantId,
      displayName: row.displayName,
      slug: row.slug,
      tenantStatus: row.tenantStatus,
      roles: [],
    };
    current.roles.push(row.role);
    grouped.set(row.membershipId, current);
  }

  return [...grouped.values()];
}

export async function resolveTenantContext(
  db: Database,
  userId: string,
  tenantSlug: string,
  area: "internal" | "portal",
) {
  const rows = await withUserDatabase(db, userId, (tx) =>
    tx
      .select({
        membershipId: tenantMemberships.id,
        membershipStatus: tenantMemberships.status,
        userId: tenantMemberships.userId,
        tenantId: tenants.id,
        displayName: tenants.displayName,
        slug: tenants.slug,
        tenantStatus: tenants.status,
        timezone: tenants.timezone,
        locale: tenants.locale,
        role: tenantMembershipRoles.role,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(
        tenantMembershipRoles,
        eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
      )
      .where(and(eq(tenantMemberships.userId, userId), eq(tenants.slug, tenantSlug))),
  );

  if (rows.length === 0) {
    return null;
  }

  const first = rows[0];
  return {
    tenant: {
      id: first.tenantId,
      displayName: first.displayName,
      slug: first.slug,
      status: first.tenantStatus,
      timezone: first.timezone,
      locale: first.locale,
    },
    membership: {
      id: first.membershipId,
      userId: first.userId,
      status: first.membershipStatus,
    },
    tenantStatus: first.tenantStatus,
    membershipStatus: first.membershipStatus,
    area,
    roles: rows.map((row) => row.role),
  };
}

export async function listTenants(db: Database) {
  return db
    .select({
      id: tenants.id,
      displayName: tenants.displayName,
      slug: tenants.slug,
      status: tenants.status,
      timezone: tenants.timezone,
      locale: tenants.locale,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
}

export async function createTenantWithInvitation(
  db: Database,
  input: {
    displayName: string;
    slug: string;
    timezone: string;
    locale: string;
    adminEmail: string;
    platformUserId: string;
    invitationTtlHours: number;
  },
) {
  const slug = validateTenantSlug(input.slug);
  const email = normalizeInvitationEmail(input.adminEmail);
  const token = createInvitationToken();
  const tenantId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + input.invitationTtlHours * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        id: tenantId,
        displayName: input.displayName.trim(),
        slug,
        timezone: input.timezone,
        locale: input.locale,
        createdByUserId: input.platformUserId,
      })
      .returning();

    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );

    const [invitation] = await tx
      .insert(tenantInvitations)
      .values({
        id: invitationId,
        tenantId,
        email,
        tokenHash: token.tokenHash,
        expiresAt,
        invitedByUserId: input.platformUserId,
        lastSentAt: new Date(),
      })
      .returning();

    await tx.insert(tenantInvitationRoles).values({
      invitationId,
      role: "tenant_admin",
    });
    await appendAuditEvent(tx, {
      tenantId,
      actorUserId: input.platformUserId,
      eventType: "tenant.created",
      targetType: "tenant",
      targetId: tenantId,
      result: "success",
      metadata: { invitationId },
    });
    await provisionDefaultPipeline(tx, { tenantId, actorUserId: input.platformUserId });
    return { tenant, invitation };
  });

  return { ...result, rawInvitationToken: token.token };
}

export async function updateTenantStatus(
  db: Database,
  input: { tenantId: string; status: "active" | "suspended"; actorUserId: string },
) {
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .for("update")
      .limit(1);
    if (!tenant) {
      return null;
    }
    const [updated] = await tx
      .update(tenants)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(tenants.id, input.tenantId))
      .returning();
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType:
        input.status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
      targetType: "tenant",
      targetId: input.tenantId,
      result: "success",
    });
    return updated;
  });
}

export async function createInvitation(
  db: Database,
  input: {
    tenantId: string;
    invitedByUserId: string;
    email: string;
    roles: TenantRole[];
    invitationTtlHours: number;
  },
) {
  if (!areRolesCompatible(input.roles)) {
    throw new Error("La combinacion de roles no es compatible.");
  }
  const token = createInvitationToken();
  const invitationId = crypto.randomUUID();
  const email = normalizeInvitationEmail(input.email);
  const expiresAt = new Date(Date.now() + input.invitationTtlHours * 60 * 60 * 1000);
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [invitation] = await tx
      .insert(tenantInvitations)
      .values({
        id: invitationId,
        tenantId: input.tenantId,
        email,
        tokenHash: token.tokenHash,
        expiresAt,
        invitedByUserId: input.invitedByUserId,
        lastSentAt: new Date(),
      })
      .returning();
    await tx
      .insert(tenantInvitationRoles)
      .values(input.roles.map((role) => ({ invitationId, role })));
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.invitedByUserId,
      eventType: "invitation.created",
      targetType: "invitation",
      targetId: invitationId,
      result: "success",
      metadata: { roleCount: input.roles.length },
    });
    return { invitation, rawInvitationToken: token.token };
  });
}

export async function hasPendingInvitationToken(
  db: Database,
  token: string,
  email: string,
): Promise<boolean> {
  const tokenHash = hashInvitationToken(token);
  const normalizedEmail = normalizeInvitationEmail(email);
  return withInvitationLookup(db, tokenHash, normalizedEmail, async (tx) => {
    const [invitation] = await tx
      .select({ id: tenantInvitations.id, status: tenantInvitations.status })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tokenHash, tokenHash),
          eq(tenantInvitations.email, normalizedEmail),
          eq(tenantInvitations.status, "pending"),
          gt(tenantInvitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return Boolean(invitation);
  });
}

export async function acceptInvitation(
  db: Database,
  input: { token: string; userId: string; userEmail: string },
) {
  const tokenHash = hashInvitationToken(input.token);
  const normalizedEmail = normalizeInvitationEmail(input.userEmail);
  return withInvitationLookup(db, tokenHash, normalizedEmail, async (tx) => {
    const [lookup] = await tx
      .select({ tenantId: tenantInvitations.tenantId })
      .from(tenantInvitations)
      .where(eq(tenantInvitations.tokenHash, tokenHash))
      .limit(1);
    if (!lookup) return null;

    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${lookup.tenantId}, true)`,
    );
    const [invitation] = await tx
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.tokenHash, tokenHash))
      .for("update")
      .limit(1);
    if (
      invitation?.status === "accepted" &&
      invitation.acceptedByUserId === input.userId
    ) {
      const [tenant] = await tx
        .select({ slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, invitation.tenantId))
        .limit(1);
      const membershipRows = await tx
        .select({
          membershipId: tenantMemberships.id,
          role: tenantMembershipRoles.role,
        })
        .from(tenantMemberships)
        .innerJoin(
          tenantMembershipRoles,
          eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
        )
        .where(
          and(
            eq(tenantMemberships.tenantId, invitation.tenantId),
            eq(tenantMemberships.userId, input.userId),
          ),
        );
      if (tenant && membershipRows.length > 0) {
        return {
          tenantId: invitation.tenantId,
          tenantSlug: tenant.slug,
          membershipId: membershipRows[0].membershipId,
          roles: membershipRows.map(({ role }) => role),
        };
      }
    }
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt <= new Date() ||
      invitation.email !== normalizedEmail
    ) {
      return null;
    }

    const [tenant] = await tx
      .select({ slug: tenants.slug, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, invitation.tenantId))
      .limit(1);
    if (!tenant || tenant.status !== "active") return null;

    const roles = await tx
      .select({ role: tenantInvitationRoles.role })
      .from(tenantInvitationRoles)
      .where(eq(tenantInvitationRoles.invitationId, invitation.id));
    const existing = await tx
      .select({ id: tenantMemberships.id, status: tenantMemberships.status })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, invitation.tenantId),
          eq(tenantMemberships.userId, input.userId),
        ),
      )
      .for("update")
      .limit(1);
    if (existing[0] && existing[0].status !== "active") {
      return null;
    }

    const membership = existing[0]
      ? existing[0]
      : (
          await tx
            .insert(tenantMemberships)
            .values({
              id: crypto.randomUUID(),
              tenantId: invitation.tenantId,
              userId: input.userId,
              status: "active",
            })
            .returning({ id: tenantMemberships.id })
        )[0];

    if (!existing[0]) {
      await tx.insert(tenantMembershipRoles).values(
        roles.map(({ role }) => ({
          membershipId: membership.id,
          role,
          assignedByUserId: invitation.invitedByUserId,
        })),
      );
    }

    await tx
      .update(tenantInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: input.userId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantInvitations.id, invitation.id));
    await appendAuditEvent(tx, {
      tenantId: invitation.tenantId,
      actorUserId: input.userId,
      eventType: "invitation.accepted",
      targetType: "invitation",
      targetId: invitation.id,
      result: "success",
      metadata: { membershipId: membership.id },
    });
    return {
      tenantId: invitation.tenantId,
      tenantSlug: tenant.slug,
      membershipId: membership.id,
      roles: roles.map(({ role }) => role),
    };
  });
}

export async function listTenantMembers(db: Database, tenantId: string) {
  return withTenantIdDatabase(db, tenantId, (tx) =>
    tx
      .select({
        membershipId: tenantMemberships.id,
        userId: tenantMemberships.userId,
        email: user.email,
        name: user.name,
        status: tenantMemberships.status,
        role: tenantMembershipRoles.role,
      })
      .from(tenantMemberships)
      .innerJoin(user, eq(user.id, tenantMemberships.userId))
      .innerJoin(
        tenantMembershipRoles,
        eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
      )
      .where(eq(tenantMemberships.tenantId, tenantId))
      .orderBy(asc(user.name), asc(tenantMembershipRoles.role)),
  );
}

export async function changeMembershipStatus(
  db: Database,
  input: {
    tenantId: string;
    membershipId: string;
    status: "active" | "suspended" | "revoked";
    actorUserId: string;
  },
) {
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .for("update")
      .limit(1);
    if (!tenant) return null;

    const [membership] = await tx
      .select({ id: tenantMemberships.id, userId: tenantMemberships.userId })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, input.tenantId),
        ),
      )
      .for("update")
      .limit(1);
    if (!membership) return null;

    if (input.status !== "active") {
      const activeAdminRows = await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .innerJoin(
          tenantMembershipRoles,
          eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
        )
        .where(
          and(
            eq(tenantMemberships.tenantId, input.tenantId),
            eq(tenantMemberships.status, "active"),
            eq(tenantMembershipRoles.role, "tenant_admin"),
          ),
        );
      if (
        activeAdminRows.length <= 1 &&
        activeAdminRows.some((row) => row.id === membership.id)
      ) {
        return { blockedLastAdmin: true as const };
      }
    }

    const [updated] = await tx
      .update(tenantMemberships)
      .set({
        status: input.status,
        updatedAt: new Date(),
        suspendedAt: input.status === "suspended" ? new Date() : null,
        revokedAt: input.status === "revoked" ? new Date() : null,
      })
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, input.tenantId),
        ),
      )
      .returning();
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: `membership.${input.status}`,
      targetType: "membership",
      targetId: input.membershipId,
      result: "success",
    });
    return { updated, blockedLastAdmin: false as const };
  });
}

export async function listTenantInvitations(db: Database, tenantId: string) {
  return withTenantIdDatabase(db, tenantId, (tx) =>
    tx
      .select({
        id: tenantInvitations.id,
        email: tenantInvitations.email,
        status: tenantInvitations.status,
        expiresAt: tenantInvitations.expiresAt,
        createdAt: tenantInvitations.createdAt,
        acceptedAt: tenantInvitations.acceptedAt,
        role: tenantInvitationRoles.role,
      })
      .from(tenantInvitations)
      .innerJoin(
        tenantInvitationRoles,
        eq(tenantInvitationRoles.invitationId, tenantInvitations.id),
      )
      .where(eq(tenantInvitations.tenantId, tenantId))
      .orderBy(desc(tenantInvitations.createdAt), asc(tenantInvitations.email)),
  );
}

export async function updateInvitationStatus(
  db: Database,
  input: {
    tenantId: string;
    invitationId: string;
    status: "revoked";
    actorUserId: string;
  },
) {
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [invitation] = await tx
      .select({ id: tenantInvitations.id, status: tenantInvitations.status })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.id, input.invitationId),
          eq(tenantInvitations.tenantId, input.tenantId),
        ),
      )
      .for("update")
      .limit(1);
    if (!invitation || invitation.status !== "pending") return null;
    const [updated] = await tx
      .update(tenantInvitations)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(tenantInvitations.id, input.invitationId))
      .returning();
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "invitation.revoked",
      targetType: "invitation",
      targetId: input.invitationId,
      result: "success",
    });
    return updated;
  });
}

export async function resendInvitation(
  db: Database,
  input: {
    tenantId: string;
    invitationId: string;
    invitationTtlHours: number;
    actorUserId: string;
  },
) {
  const token = createInvitationToken();
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [invitation] = await tx
      .select({
        id: tenantInvitations.id,
        email: tenantInvitations.email,
        status: tenantInvitations.status,
      })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.id, input.invitationId),
          eq(tenantInvitations.tenantId, input.tenantId),
        ),
      )
      .for("update")
      .limit(1);
    if (!invitation || invitation.status !== "pending") return null;
    const [updated] = await tx
      .update(tenantInvitations)
      .set({
        tokenHash: token.tokenHash,
        expiresAt: new Date(Date.now() + input.invitationTtlHours * 60 * 60 * 1000),
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantInvitations.id, input.invitationId))
      .returning();
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "invitation.resent",
      targetType: "invitation",
      targetId: input.invitationId,
      result: "success",
    });
    return {
      invitation: updated,
      recipient: invitation.email,
      rawInvitationToken: token.token,
    };
  });
}

export async function replaceMembershipRoles(
  db: Database,
  input: {
    tenantId: string;
    membershipId: string;
    roles: TenantRole[];
    actorUserId: string;
  },
) {
  if (!areRolesCompatible(input.roles)) {
    throw new Error("La combinacion de roles no es compatible.");
  }
  return withTenantIdDatabase(db, input.tenantId, async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .for("update")
      .limit(1);
    if (!tenant) return null;

    const [membership] = await tx
      .select({ id: tenantMemberships.id, status: tenantMemberships.status })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, input.tenantId),
        ),
      )
      .for("update")
      .limit(1);
    if (!membership || membership.status === "revoked") return null;

    if (!input.roles.includes("tenant_admin")) {
      const admins = await tx
        .select({ membershipId: tenantMembershipRoles.membershipId })
        .from(tenantMembershipRoles)
        .innerJoin(
          tenantMemberships,
          eq(tenantMemberships.id, tenantMembershipRoles.membershipId),
        )
        .where(
          and(
            eq(tenantMemberships.tenantId, input.tenantId),
            eq(tenantMemberships.status, "active"),
            eq(tenantMembershipRoles.role, "tenant_admin"),
          ),
        );
      if (
        admins.length <= 1 &&
        admins.some((admin) => admin.membershipId === input.membershipId)
      ) {
        return { blockedLastAdmin: true as const };
      }
    }

    await tx
      .delete(tenantMembershipRoles)
      .where(eq(tenantMembershipRoles.membershipId, input.membershipId));
    await tx.insert(tenantMembershipRoles).values(
      input.roles.map((role) => ({
        membershipId: input.membershipId,
        role,
        assignedByUserId: input.actorUserId,
      })),
    );
    await appendAuditEvent(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      eventType: "membership.roles_changed",
      targetType: "membership",
      targetId: input.membershipId,
      result: "success",
      metadata: { roles: input.roles },
    });
    return { blockedLastAdmin: false as const };
  });
}
