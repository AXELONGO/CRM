export const tenantRoles = [
  "tenant_admin",
  "sales",
  "execution",
  "finance",
  "client",
] as const;

export type TenantRole = (typeof tenantRoles)[number];

export const platformPermissions = [
  "platform.tenants.view",
  "platform.tenants.create",
  "platform.tenants.suspend",
  "platform.tenants.reactivate",
] as const;

export const tenantPermissions = [
  "tenant.view",
  "tenant.update",
  "members.view",
  "members.invite",
  "members.roles.manage",
  "members.status.manage",
  "security_audit.view",
  "contacts.view",
  "contacts.create",
  "contacts.update",
  "contacts.archive",
  "contacts.restore",
  "contacts.notes.create",
  "contacts.notes.update_own",
  "contacts.notes.manage",
  "contacts.communication_preferences.manage",
  "accounts.view",
  "accounts.create",
  "accounts.update",
  "accounts.archive",
  "accounts.restore",
  "accounts.notes.create",
  "accounts.notes.update_own",
  "accounts.notes.manage",
  "tags.view",
  "tags.manage",
  "pipelines.view",
  "pipelines.manage",
  "pipeline_stages.manage",
  "lead_sources.manage",
  "lost_reasons.manage",
  "opportunities.view",
  "opportunities.create",
  "opportunities.update",
  "opportunities.move",
  "opportunities.assign",
  "opportunities.close_won",
  "opportunities.close_lost",
  "opportunities.reopen",
  "opportunities.archive",
  "opportunities.restore",
  "sales_activities.view",
  "sales_activities.create",
  "sales_activities.update_own",
  "sales_activities.manage",
  "sales_forecast.view",
  "inbox.view",
  "inbox.reply",
  "inbox.assign",
  "inbox.status.manage",
  "inbox.notes.create",
  "inbox.identity.resolve",
  "inbox.opportunity.link",
  "inbox.dead_letters.view",
  "inbox.dead_letters.retry",
  "integrations.view",
  "integrations.manage",
  "integration_secrets.rotate",
  "forms.view",
  "forms.manage",
  "automations.view",
  "automations.manage",
  "calendars.manage",
  "sla.manage",
  "notifications.view",
  "notifications.manage",
  "quotes.view",
  "quotes.create",
  "quotes.update",
  "quotes.manage",
  "quotes.issue",
  "quotes.send",
  "quotes.revoke_link",
  "quotes.cancel",
  "quotes.decision_evidence.read",
  "quote_templates.read",
  "quote_templates.manage",
  "service_catalog.read",
  "service_catalog.manage",
  "commercial_document_settings.manage",
  "agreements.read",
  "agreements.create",
  "agreements.update_draft",
  "agreements.issue",
  "agreements.manage_envelope",
  "agreements.sign_internal",
  "agreements.evidence.read",
  "agreements.submit_review",
  "agreements.review",
  "agreements.external_evidence.upload",
  "agreements.external_evidence.verify",
  "agreement_templates.manage",
  "agreement_policies.manage",
  "payments.read",
  "payments.read_financial_detail",
  "payments.create_plan",
  "payments.cancel_plan",
  "payments.create_request",
  "payments.cancel_request",
  "payments.copy_link",
  "payments.record_manual",
  "payments.review_manual",
  "payments.allocate",
  "payments.reverse_manual",
  "payments.reconcile",
  "payments.view_evidence",
  "payments.download_receipt",
  "payments.manage_connections",
  "payments.manage_settings",
  "projects.read",
  "projects.read_commercial_origin",
  "projects.create_manual_draft",
  "projects.manage_draft",
  "projects.request_activation",
  "projects.approve_activation",
  "projects.activate",
  "projects.manage_team",
  "projects.put_on_hold",
  "projects.resume",
  "projects.complete",
  "projects.cancel",
  "projects.archive",
  "project_templates.read",
  "project_templates.manage",
  "project_templates.publish",
  "project_tasks.read",
  "project_tasks.create",
  "project_tasks.edit",
  "project_tasks.assign",
  "project_tasks.move",
  "project_tasks.review",
  "project_tasks.reopen",
  "content.read",
  "content.manage",
  "content.review",
  "content.manage_settings",
  "integrations.catalog.read",
  "integrations.connection.create",
  "integrations.connection.configure",
  "integrations.connection.verify",
  "integrations.connection.activate",
  "integrations.connection.disable",
  "integrations.connection.revoke",
  "integrations.provider.select",
  "integrations.health.read",
  "integrations.activity.read",
  "integrations.usage.read",
  "integrations.webhook.simulate",
  "integrations.template.read",
  "integrations.template.sync",
  "integrations.waha.instance.read",
  "integrations.waha.connection.configure",
  "integrations.waha.risk.accept",
  "integrations.waha.session.provision",
  "integrations.waha.session.start",
  "integrations.waha.session.control",
  "integrations.waha.session.logout",
  "integrations.waha.session.delete",
  "integrations.waha.qr.read",
  "integrations.waha.identity.confirm",
  "integrations.waha.keys.rotate",
  "integrations.waha.webhook.configure",
  "integrations.waha.cutover",
  "integrations.mercado_pago.read",
  "integrations.mercado_pago.connect",
  "integrations.mercado_pago.reauthorize",
  "integrations.mercado_pago.disconnect",
  "integrations.mercado_pago.health.read",
  "payments.links.create",
  "payments.links.read",
  "payments.reconciliation.read",
  "payments.reconciliation.retry",
  "payments.exceptions.resolve",
  "payments.provider.select",
  "integrations.stripe.read",
  "integrations.stripe.connect",
  "integrations.stripe.reconnect",
  "integrations.stripe.disconnect",
  "integrations.stripe.health.read",
  "integrations.paypal.read",
  "integrations.paypal.connect",
  "integrations.paypal.disconnect",
  "integrations.paypal.health.read",
  "payments.paypal.capture",
] as const;

export type Permission =
  (typeof platformPermissions)[number] | (typeof tenantPermissions)[number];

export const reservedTenantSlugs = new Set([
  "app",
  "api",
  "admin",
  "platform",
  "portal",
  "login",
  "www",
]);

export function normalizeTenantSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidTenantSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 63;
}

export function validateTenantSlug(value: string): string {
  const slug = normalizeTenantSlug(value);
  if (!isValidTenantSlug(slug) || reservedTenantSlugs.has(slug)) {
    throw new Error("El slug de la agencia no es valido o esta reservado.");
  }
  return slug;
}

export function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function areRolesCompatible(roles: readonly TenantRole[]): boolean {
  const uniqueRoles = new Set(roles);
  if (uniqueRoles.size !== roles.length || uniqueRoles.size === 0) {
    return false;
  }
  return !uniqueRoles.has("client") || uniqueRoles.size === 1;
}

export type TenantAuthorizationContext = {
  tenantStatus: "active" | "suspended";
  membershipStatus: "active" | "suspended" | "revoked";
  roles: readonly TenantRole[];
  area: "internal" | "portal";
};

export type AuthorizationActor = {
  userId: string;
  isPlatformAdministrator: boolean;
};

export class AuthorizationDeniedError extends Error {
  statusCode = 403 as const;

  constructor(message = "No tienes permiso para realizar esta accion.") {
    super(message);
    this.name = "AuthorizationDeniedError";
  }
}

export function can(
  actor: AuthorizationActor,
  action: Permission,
  context?: TenantAuthorizationContext,
): boolean {
  if (action.startsWith("platform.")) {
    return actor.isPlatformAdministrator;
  }

  if (
    !context ||
    context.tenantStatus !== "active" ||
    context.membershipStatus !== "active"
  ) {
    return false;
  }

  if (context.area === "portal") {
    return action === "tenant.view" && context.roles.includes("client");
  }

  if (context.roles.includes("tenant_admin")) {
    return true;
  }

  if (context.roles.includes("client")) return action === "tenant.view";

  if (context.roles.includes("sales")) {
    return (
      action === "tenant.view" ||
      action.startsWith("contacts.") ||
      action.startsWith("accounts.") ||
      action === "tags.view" ||
      action.startsWith("opportunities.") ||
      action.startsWith("sales_activities.") ||
      action === "sales_forecast.view" ||
      action === "quotes.view" ||
      action === "quotes.create" ||
      action === "quotes.update" ||
      action === "agreements.read" ||
      action === "agreements.create" ||
      action === "agreements.update_draft" ||
      action === "agreements.issue" ||
      action === "agreements.manage_envelope" ||
      action === "agreements.sign_internal" ||
      action === "agreements.external_evidence.upload" ||
      action === "agreements.external_evidence.verify" ||
      action === "agreements.submit_review" ||
      action === "agreements.review" ||
      action === "pipelines.view" ||
      action === "inbox.view" ||
      action === "inbox.reply" ||
      action === "inbox.assign" ||
      action === "inbox.status.manage" ||
      action === "inbox.notes.create" ||
      action === "inbox.identity.resolve" ||
      action === "inbox.opportunity.link" ||
      action === "automations.view" ||
      action === "notifications.view" ||
      action === "payments.read" ||
      action === "payments.create_request" ||
      action === "payments.copy_link" ||
      action === "projects.read" ||
      action === "projects.read_commercial_origin" ||
      action === "projects.request_activation" ||
      action.startsWith("content.")
    );
  }

  if (context.roles.includes("execution") || context.roles.includes("finance")) {
    return (
      action === "tenant.view" ||
      action === "contacts.view" ||
      action === "contacts.notes.create" ||
      action === "accounts.view" ||
      action === "accounts.notes.create" ||
      action === "tags.view" ||
      action === "opportunities.view" ||
      action === "quotes.view" ||
      action === "agreements.read" ||
      action === "sales_activities.view" ||
      action === "inbox.view" ||
      action === "automations.view" ||
      action === "notifications.view" ||
      action.startsWith("payments.") ||
      action.startsWith("projects.") ||
      action.startsWith("project_templates.") ||
      action.startsWith("project_tasks.") ||
      action.startsWith("content.")
    );
  }

  return false;
}

export function requirePermission(
  actor: AuthorizationActor,
  action: Permission,
  context?: TenantAuthorizationContext,
): void {
  if (!can(actor, action, context)) {
    throw new AuthorizationDeniedError();
  }
}
