import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/infrastructure/database/schema";

const migrationURL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";
const runtimeURL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://crm_runtime:crm_runtime_password@127.0.0.1:5433/crm_test";
const ingressURL =
  process.env.TEST_DATABASE_INGRESS_URL ??
  "postgresql://crm_ingress:crm_ingress_password@127.0.0.1:5433/crm_test";
const workerURL =
  process.env.TEST_DATABASE_WORKER_URL ??
  "postgresql://crm_worker:crm_worker_password@127.0.0.1:5433/crm_test";

export const migrationURL_ = migrationURL;
export const runtimeURL_ = runtimeURL;
export const ingressURL_ = ingressURL;
export const workerURL_ = workerURL;

export function migrationSql() {
  return postgres(migrationURL, { prepare: false, max: 5 });
}

export function runtimeSql() {
  return postgres(runtimeURL, { prepare: false, max: 5 });
}

export function ingressSql() {
  return postgres(ingressURL, { prepare: false, max: 5 });
}

export function workerSql() {
  return postgres(workerURL, { prepare: false, max: 5 });
}

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function drizzleFrom(sql: ReturnType<typeof postgres>) {
  return drizzle(sql, { schema }) as unknown as TestDb;
}

export function ingressDb() {
  const sql = ingressSql();
  return { db: drizzleFrom(sql) as TestDb, close: () => sql.end({ timeout: 2 }) };
}

export function runtimeDb() {
  const sql = runtimeSql();
  return { db: drizzleFrom(sql) as TestDb, close: () => sql.end({ timeout: 2 }) };
}

export const TRUNCATE_TABLES = [
  "agreement_internal_reviews",
  "agreement_template_versions",
  "agreement_templates",
  "agreement_clause_versions",
  "agreement_clause_blocks",
  "agreement_review_policies",
  "agreement_acceptance_actions",
  "agreement_evidence_bundles",
  "agreement_external_execution_records",
  "agreement_public_sessions",
  "agreement_recipient_links",
  "agreement_recipients",
  "agreement_envelopes",
  "agreement_versions",
  "agreement_drafts",
  "agreement_outbox_events",
  "agreements",
  "agreement_number_sequences",
  "quote_email_challenges",
  "quote_client_decisions",
  "quote_draft_sections",
  "quote_draft_items",
  "quote_drafts",
  "commercial_tax_rates",
  "quote_public_sessions",
  "quote_items",
  "quote_public_links",
  "quote_versions",
  "quotes",
  "quote_number_sequences",
  "sales_activities",
  "sales_domain_events",
  "sales_lead_sources",
  "sales_lost_reasons",
  "sales_opportunity_participants",
  "sales_stage_history",
  "sales_state_history",
  "sales_opportunities",
  "sales_pipeline_stages",
  "sales_pipelines",
  "crm_commercial_audit_events",
  "crm_communication_consent_events",
  "crm_contact_tags",
  "crm_account_tags",
  "crm_contact_notes",
  "crm_account_notes",
  "crm_contact_methods",
  "crm_account_contacts",
  "crm_contacts",
  "crm_accounts",
  "crm_tags",
  "portal_access_project_scopes",
  "portal_accesses",
  "portal_brand_profiles",
  "portal_deliverable_decisions",
  "portal_deliverable_versions",
  "portal_deliverables",
  "portal_domains",
  "portal_invitations",
  "portal_messages",
  "portal_outbox_events",
  "projects",
  "project_templates",
  "project_template_phases",
  "project_phases",
  "project_phase_tasks",
  "project_tasks",
  "project_dependencies",
  "project_number_sequences",
  "tasks",
  "automation_action_runs",
  "automation_events",
  "automation_jobs",
  "automation_rule_runs",
  "automation_rule_versions",
  "automation_rules",
  "assignment_queue_members",
  "inbox_conversations",
  "internal_notifications",
  "resource_reminders",
  "webhook_receipts",
  "inbox_messages",
  "inbox_attachments",
  "inbox_channel_identities",
  "inbox_webhook_routes",
  "inbox_forms",
  "inbox_connections",
  "integration_jobs",
  "integration_secret_values",
  "integration_provider_events",
  "payment_records",
  "payment_allocations",
  "payment_attempts",
  "payment_adjustments",
  "payment_provider_events",
  "payment_secret_values",
  "payment_requests",
  "payment_connections",
  "receivable_installments",
  "deposit_requirements",
  "receivable_plans",
  "mercado_pago_profiles",
  "stripe_profiles",
  "paypal_profiles",
  "oauth_authorization_attempts",
  "security_audit_events",
  "tenant_membership_roles",
  "tenant_invitation_roles",
  "tenant_memberships",
  "tenant_invitations",
  "tenants",
  "platform_administrators",
  "session",
  "account",
  "verification",
  "twoFactor",
  "user",
];

export async function resetTestDatabase(): Promise<void> {
  const sql = migrationSql();
  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `;
    for (const row of tables) {
      await sql`truncate ${sql.unsafe(`"${row.tablename}"`)} cascade`;
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

type RawSql = ReturnType<typeof postgres>;

export async function withTenantTx<T>(
  tenantId: string,
  fn: (tx: RawSql) => Promise<T>,
): Promise<T> {
  const sql = runtimeSql();
  try {
    return await sql.begin(async (t) => {
      await t`select set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(t);
    });
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export async function withMigrationTenantTx<T>(
  tenantId: string,
  fn: (tx: RawSql) => Promise<T>,
): Promise<T> {
  const sql = migrationSql();
  try {
    return await sql.begin(async (t) => {
      await t`select set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(t);
    });
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export function syntheticUser(sql: RawSql, id: string, email: string) {
  return sql`
    insert into "user" (id, name, email, email_verified) values (${id}, ${id}, ${email}, true)
    on conflict (id) do nothing
  `;
}

export function syntheticTenant(sql: RawSql, id: string, createdByUserId: string) {
  return sql`
    insert into tenants (id, display_name, slug, created_by_user_id)
    values (${id}, ${id}, ${id.toLowerCase()}, ${createdByUserId})
    on conflict (id) do nothing
  `;
}

export async function syntheticQuote(
  tenantId: string,
  quoteId: string,
  userId: string,
) {
  const contactId = `quote-contact:${quoteId}`;
  const email = `quote-${quoteId}@example.test`;
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into crm_contacts (
        id, tenant_id, display_name, display_name_normalized,
        created_by_user_id, updated_by_user_id
      ) values (
        ${contactId}, ${tenantId}, 'Quote recipient', 'quote recipient',
        ${userId}, ${userId}
      )
    `;
    await t`
      insert into crm_contact_methods (
        id, tenant_id, contact_id, type, label, original_value, normalized_value,
        is_primary, created_by_user_id, updated_by_user_id
      ) values (
        ${`quote-email:${quoteId}`}, ${tenantId}, ${contactId}, 'email', 'work',
        ${email}, ${email}, true, ${userId}, ${userId}
      )
    `;
    await t`
      insert into quotes (
        id, tenant_id, number, status, title, currency, contact_id,
        created_by_user_id, updated_by_user_id
      ) values (
        ${quoteId}, ${tenantId}, 'COT-1', 'issued', 'Quote', 'MXN', ${contactId},
        ${userId}, ${userId}
      )
    `;
  });
}

export async function syntheticQuotePublicLink(
  tenantId: string,
  quoteId: string,
  linkId: string,
  tokenHash: string,
  userId: string,
) {
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into quote_public_links (id, tenant_id, quote_id, token_hash, active, expires_at, created_by_user_id)
      values (${linkId}, ${tenantId}, ${quoteId}, ${tokenHash}, true, now() + interval '1 day', ${userId})
    `;
  });
}

export async function syntheticQuotePublicSession(
  tenantId: string,
  quoteId: string,
  sessionId: string,
  sessionHash: string,
  csrfHash: string,
) {
  await withTenantTx(tenantId, async (t) => {
    await t`
      insert into quote_public_sessions (id, tenant_id, quote_id, session_hash, csrf_hash, expires_at)
      values (${sessionId}, ${tenantId}, ${quoteId}, ${sessionHash}, ${csrfHash}, now() + interval '1 day')
    `;
  });
}
