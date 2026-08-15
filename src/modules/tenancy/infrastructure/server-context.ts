import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth, assertAuthRuntimeConfig } from "@/infrastructure/auth/auth";
import { getDatabase } from "@/infrastructure/database/client";
import {
  isPlatformAdministrator,
  resolveTenantContext,
} from "@/modules/tenancy/infrastructure/repositories";
import type { AuthorizationActor } from "@/modules/tenancy/domain/policy";
import type { TenantContext } from "@/modules/tenancy/application/ports/tenant-context";
import { can, requirePermission } from "@/modules/tenancy/domain/policy";
import { getEnvironment } from "@/infrastructure/config/env";
import { user } from "@/infrastructure/database/schema/auth";
import { eq } from "drizzle-orm";
import { listUserMemberships } from "@/modules/tenancy/infrastructure/repositories";
import { requiresPrivilegedMfa } from "@/modules/tenancy/domain/mfa";

export class PrivilegedMfaRequiredError extends Error {
  constructor() {
    super("PRIVILEGED_MFA_REQUIRED");
    this.name = "PrivilegedMfaRequiredError";
  }
}

async function hasRequiredMfa(userId: string): Promise<boolean> {
  const environment = getEnvironment();
  if (!environment.MFA_ENFORCEMENT_ENABLED) return true;
  const db = getDatabase();
  const [identity] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const memberships = await listUserMemberships(db, userId);
  const privileged =
    memberships.some((membership) => requiresPrivilegedMfa(membership.roles, false)) ||
    requiresPrivilegedMfa([], await isPlatformAdministrator(db, userId));
  return !privileged || Boolean(identity?.twoFactorEnabled);
}

export async function requirePrivilegedMfa(userId: string): Promise<void> {
  if (!(await hasRequiredMfa(userId))) redirect("/app/security/mfa");
}

export async function getSessionFromRequest(request: Request) {
  assertAuthRuntimeConfig();
  return auth.api.getSession({ headers: request.headers });
}

export async function getRequestActor(
  request: Request,
): Promise<AuthorizationActor | null> {
  const session = await getSessionFromRequest(request);
  if (!session) return null;
  if (!(await hasRequiredMfa(session.user.id))) {
    throw new PrivilegedMfaRequiredError();
  }
  return {
    userId: session.user.id,
    isPlatformAdministrator: await isPlatformAdministrator(
      getDatabase(),
      session.user.id,
    ),
  };
}

export async function requirePlatformActor(
  request: Request,
): Promise<AuthorizationActor> {
  const actor = await getRequestActor(request);
  if (!actor || !actor.isPlatformAdministrator) {
    throw new Error("PLATFORM_FORBIDDEN");
  }
  requirePermission(actor, "platform.tenants.view");
  return actor;
}

export async function requireServerIdentity() {
  assertAuthRuntimeConfig();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) {
    redirect("/login?next=%2Fapp");
  }
  return session;
}

export async function requireServerPlatformAdministrator() {
  const session = await requireServerIdentity();
  await requirePrivilegedMfa(session.user.id);
  if (!(await isPlatformAdministrator(getDatabase(), session.user.id))) {
    redirect("/app");
  }
  return session;
}

export async function requireServerTenant(
  tenantSlug: string,
  area: "internal" | "portal",
) {
  const session = await requireServerIdentity();
  await requirePrivilegedMfa(session.user.id);
  const context = await resolveTenantContext(
    getDatabase(),
    session.user.id,
    tenantSlug,
    area,
  );
  if (!context) notFound();
  const actor = {
    userId: session.user.id,
    isPlatformAdministrator: await isPlatformAdministrator(
      getDatabase(),
      session.user.id,
    ),
  };
  if (!can(actor, "tenant.view", context)) notFound();
  return { session, context: context as TenantContext };
}
