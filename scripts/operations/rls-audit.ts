import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";

const catalogUrl = process.env.DATABASE_MIGRATION_URL;
const runtimeUrl = process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_WORKER_URL;
const rollbackMarker = "RLS_AUDIT_ROLLBACK";

if (!catalogUrl) throw new Error("DATABASE_MIGRATION_URL_REQUIRED");
if (!runtimeUrl) throw new Error("DATABASE_URL_REQUIRED");
if (!workerUrl) throw new Error("DATABASE_WORKER_URL_REQUIRED");

function assertLocalDatabase(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) {
    throw new Error("RLS_AUDIT_LOCAL_DATABASE_REQUIRED");
  }
}

assertLocalDatabase(catalogUrl);
assertLocalDatabase(runtimeUrl);
assertLocalDatabase(workerUrl);

const catalog = postgres(catalogUrl, { prepare: false, max: 1 });
const runtime = postgres(runtimeUrl, { prepare: false, max: 1 });
const worker = postgres(workerUrl, { prepare: false, max: 1 });

type ScopedTable = {
  tableName: string;
  hasRls: boolean;
  forceRls: boolean;
  runtimeSelect: boolean;
  workerSelect: boolean;
  policyCount: number;
};

const d01MigrationTag = "0043_d01_ingress_session_capability";
const d01MigrationFile = new URL(
  "../../drizzle/0043_d01_ingress_session_capability.sql",
  import.meta.url,
);
const d01JournalFile = new URL("../../drizzle/meta/_journal.json", import.meta.url);
const d01Functions = [
  {
    name: "exchange_quote_link_and_create_session",
    argumentTypes: "text, text, text, timestamp with time zone",
  },
  {
    name: "create_quote_email_challenge",
    argumentTypes: "text, text, text, timestamp with time zone",
  },
  {
    name: "record_quote_otp_attempt",
    argumentTypes: "text, text, integer, text, timestamp with time zone",
  },
  { name: "rotate_quote_session_csrf", argumentTypes: "text, text" },
  { name: "consume_quote_email_challenge", argumentTypes: "text, text" },
  { name: "apply_quote_decision_status", argumentTypes: "text, text" },
  {
    name: "reconcile_project_commercial_scope",
    argumentTypes: "text, text, text",
  },
] as const;

type D01FunctionCatalog = {
  name: string;
  argumentTypes: string;
  securityDefiner: boolean;
  config: string;
  owner: string;
  ownerRuntimeMember: boolean;
  executeGrantees: string[];
};

async function auditD01SessionCapabilities(): Promise<void> {
  if (!existsSync(d01MigrationFile)) {
    throw new Error("D01_MIGRATION_FILE_MISSING");
  }
  if (!existsSync(d01JournalFile)) {
    throw new Error("D01_MIGRATION_JOURNAL_MISSING");
  }

  const journal = JSON.parse(readFileSync(d01JournalFile, "utf8")) as {
    entries?: Array<{ idx: number; tag: string; when: number }>;
  };
  const entry = journal.entries?.find(({ tag }) => tag === d01MigrationTag);
  if (!entry || entry.idx !== 42) {
    throw new Error("D01_MIGRATION_JOURNAL_MISSING");
  }

  const [migration] = await catalog<{ applied: boolean }[]>`
    select exists(
      select 1
      from drizzle.__drizzle_migrations
      where created_at = ${entry.when}
    ) as "applied"
  `;
  if (!migration?.applied) throw new Error("D01_MIGRATION_NOT_APPLIED");

  const functions = await catalog<D01FunctionCatalog[]>`
    select
      p.proname as "name",
      oidvectortypes(p.proargtypes) as "argumentTypes",
      p.prosecdef as "securityDefiner",
      coalesce(array_to_string(p.proconfig, ','), '') as "config",
      owner_role.rolname as "owner",
      exists (
        select 1
        from pg_roles runtime_role
        where runtime_role.rolname in ('crm_ingress', 'crm_runtime', 'crm_worker')
          and (
            runtime_role.oid = owner_role.oid
            or pg_has_role(owner_role.oid, runtime_role.oid, 'MEMBER')
          )
      ) as "ownerRuntimeMember",
      coalesce(
        array_agg(coalesce(grantee.rolname, 'PUBLIC') order by coalesce(grantee.rolname, 'PUBLIC'))
          filter (where acl.privilege_type = 'EXECUTE'),
        '{}'::text[]
      ) as "executeGrantees"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles owner_role on owner_role.oid = p.proowner
    left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'public'
      and p.proname in (
        'exchange_quote_link_and_create_session',
        'create_quote_email_challenge',
        'record_quote_otp_attempt',
        'rotate_quote_session_csrf',
        'consume_quote_email_challenge',
        'apply_quote_decision_status',
        'reconcile_project_commercial_scope'
      )
    group by p.oid, owner_role.oid, owner_role.rolname
    order by p.proname
  `;

  if (functions.length !== d01Functions.length) {
    throw new Error("D01_FUNCTIONS_MISSING");
  }

  for (const expected of d01Functions) {
    const fn = functions.find(
      ({ name, argumentTypes }) =>
        name === expected.name && argumentTypes === expected.argumentTypes,
    );
    if (!fn) throw new Error(`D01_FUNCTION_SIGNATURE_MISMATCH:${expected.name}`);
    if (!fn.securityDefiner) {
      throw new Error(`D01_FUNCTION_NOT_SECURITY_DEFINER:${expected.name}`);
    }
    if (fn.config !== "search_path=pg_catalog, public") {
      throw new Error(`D01_FUNCTION_UNSAFE_SEARCH_PATH:${expected.name}`);
    }
    if (fn.ownerRuntimeMember) {
      throw new Error(`D01_FUNCTION_RUNTIME_OWNER:${expected.name}`);
    }
    const expectedGrantees = [fn.owner, "crm_ingress"].sort();
    if (fn.executeGrantees.join(",") !== expectedGrantees.join(",")) {
      throw new Error(`D01_FUNCTION_EXECUTE_UNSAFE:${expected.name}`);
    }
  }
}

async function auditCatalog(): Promise<ScopedTable[]> {
  const [runtimeRole] = await catalog<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = 'crm_runtime'
  `;
  if (!runtimeRole) throw new Error("RUNTIME_ROLE_MISSING");
  if (runtimeRole.rolsuper || runtimeRole.rolbypassrls) {
    throw new Error("RUNTIME_ROLE_UNSAFE");
  }
  const [workerRole] = await catalog<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = 'crm_worker'
  `;
  if (!workerRole) throw new Error("WORKER_ROLE_MISSING");
  if (workerRole.rolsuper || workerRole.rolbypassrls) {
    throw new Error("WORKER_ROLE_UNSAFE");
  }

  const tables = await catalog<ScopedTable[]>`
    select
      c.relname as "tableName",
      c.relrowsecurity as "hasRls",
      c.relforcerowsecurity as "forceRls",
      has_table_privilege('crm_runtime', c.oid, 'SELECT') as "runtimeSelect",
      has_table_privilege('crm_worker', c.oid, 'SELECT') as "workerSelect",
      (select count(*)::int from pg_policy p where p.polrelid = c.oid) as "policyCount"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'tenant_id'
          and a.attnum > 0
          and not a.attisdropped
      )
    order by c.relname
  `;
  if (tables.length === 0) throw new Error("RLS_CATALOG_EMPTY");

  const unprotected = tables.filter(
    (table) => !table.hasRls || !table.forceRls || table.policyCount === 0,
  );
  if (unprotected.length > 0) {
    throw new Error(
      `RLS_TABLES_UNPROTECTED:${unprotected.map(({ tableName }) => tableName).join(",")}`,
    );
  }

  const policyGaps = await catalog<{ tableName: string; command: string }[]>`
    with scoped as (
      select c.oid, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = c.oid
            and a.attname = 'tenant_id'
            and a.attnum > 0
            and not a.attisdropped
        )
    ), operations(command, policy_command, privilege, needs_using, needs_check) as (
      values
        ('SELECT', 'r', 'SELECT', true, false),
        ('INSERT', 'a', 'INSERT', false, true),
        ('UPDATE', 'w', 'UPDATE', true, true),
        ('DELETE', 'd', 'DELETE', true, false)
    )
    select s.relname as "tableName", o.command
    from scoped s
    cross join operations o
    where has_table_privilege('crm_runtime', s.oid, o.privilege)
      and not exists (
        select 1
        from pg_policy p
        where p.polrelid = s.oid
          and p.polcmd::text in ('*', o.policy_command)
          and (
            0 = any(p.polroles)
            or (select oid from pg_roles where rolname = 'crm_runtime') = any(p.polroles)
          )
          and (not o.needs_using or p.polqual is not null)
          and (not o.needs_check or p.polwithcheck is not null)
      )
    order by s.relname, o.command
  `;
  if (policyGaps.length > 0) {
    throw new Error(
      `RLS_POLICY_GAPS:${policyGaps
        .map(({ tableName, command }) => `${tableName}:${command}`)
        .join(",")}`,
    );
  }

  return tables;
}

async function auditNoContext(tables: ScopedTable[]): Promise<number> {
  const [{ currentUser }] = await runtime<{ currentUser: string }[]>`
    select current_user as "currentUser"
  `;
  if (currentUser !== "crm_runtime") {
    throw new Error(`RLS_WRONG_RUNTIME_ROLE:${currentUser}`);
  }

  const readable = tables.filter(({ runtimeSelect }) => runtimeSelect);
  if (readable.length === 0) throw new Error("RLS_NO_RUNTIME_TABLES");

  for (const { tableName } of readable) {
    const [{ rows }] = await runtime<{ rows: number }[]>`
      select count(*)::int as rows from ${runtime("public")}.${runtime(tableName)}
    `;
    if (rows !== 0) throw new Error(`RLS_NO_CONTEXT_LEAK:${tableName}:${rows}`);
  }
  return readable.length;
}

async function auditWorkerNoContext(tables: ScopedTable[]): Promise<number> {
  const [{ currentUser }] = await worker<{ currentUser: string }[]>`
    select current_user as "currentUser"
  `;
  if (currentUser !== "crm_worker") {
    throw new Error(`RLS_WRONG_WORKER_ROLE:${currentUser}`);
  }

  const readable = tables.filter(({ workerSelect }) => workerSelect);
  if (readable.length === 0) throw new Error("RLS_NO_WORKER_TABLES");

  for (const { tableName } of readable) {
    const [{ rows }] = await worker<{ rows: number }[]>`
      select count(*)::int as rows from ${worker("public")}.${worker(tableName)}
    `;
    if (rows !== 0) throw new Error(`RLS_WORKER_NO_CONTEXT_LEAK:${tableName}:${rows}`);
  }
  return readable.length;
}

async function auditTenantBehavior(): Promise<void> {
  const suffix = crypto.randomUUID();
  const userA = `rls-user-a-${suffix}`;
  const userB = `rls-user-b-${suffix}`;
  const tenantA = `rls-a-${suffix}`;
  const tenantB = `rls-b-${suffix}`;
  const membershipA = `rls-membership-a-${suffix}`;
  const membershipB = `rls-membership-b-${suffix}`;
  const tagA = `rls-tag-a-${suffix}`;
  const tagB = `rls-tag-b-${suffix}`;
  const invitationId = `rls-invitation-${suffix}`;
  const invitationHash = `rls-hash-${suffix}`;
  const invitationEmail = `rls-${suffix}@example.test`;

  try {
    await runtime.begin(async (tx) => {
      await tx`
        insert into "user" (id, name, email, email_verified)
        values
          (${userA}, 'RLS probe A', ${`${userA}@example.test`}, true),
          (${userB}, 'RLS probe B', ${`${userB}@example.test`}, true)
      `;
      await tx`
        insert into tenants (id, display_name, slug, created_by_user_id)
        values
          (${tenantA}, 'RLS probe A', ${tenantA}, ${userA}),
          (${tenantB}, 'RLS probe B', ${tenantB}, ${userB})
      `;

      await tx`select set_config('app.current_tenant_id', ${tenantA}, true)`;
      await tx`
        insert into tenant_memberships (id, tenant_id, user_id)
        values (${membershipA}, ${tenantA}, ${userA})
      `;
      await tx`
        insert into tenant_invitations
          (id, tenant_id, email, token_hash, expires_at, invited_by_user_id)
        values
          (${invitationId}, ${tenantA}, ${invitationEmail}, ${invitationHash}, now() + interval '1 hour', ${userA})
      `;
      await tx`
        insert into crm_tags (id, tenant_id, name, name_normalized, created_by_user_id)
        values (${tagA}, ${tenantA}, 'RLS A', ${tagA}, ${userA})
      `;

      await tx`select set_config('app.current_tenant_id', ${tenantB}, true)`;
      await tx`
        insert into tenant_memberships (id, tenant_id, user_id)
        values (${membershipB}, ${tenantB}, ${userB})
      `;
      await tx`
        insert into crm_tags (id, tenant_id, name, name_normalized, created_by_user_id)
        values (${tagB}, ${tenantB}, 'RLS B', ${tagB}, ${userB})
      `;

      await tx`select set_config('app.current_tenant_id', '', true)`;
      const [{ noContextRows }] = await tx<{ noContextRows: number }[]>`
        select count(*)::int as "noContextRows"
        from crm_tags where id in (${tagA}, ${tagB})
      `;
      if (noContextRows !== 0) throw new Error("RLS_FIXTURE_NO_CONTEXT_LEAK");

      await tx`select set_config('app.current_user_id', ${userA}, true)`;
      const memberships = await tx<{ id: string }[]>`
        select id from tenant_memberships
        where id in (${membershipA}, ${membershipB})
      `;
      if (memberships.length !== 1 || memberships[0].id !== membershipA) {
        throw new Error("RLS_USER_LOOKUP_FAILED");
      }
      await tx`select set_config('app.current_user_id', '', true)`;

      await tx`select set_config('app.invitation_token_hash', ${invitationHash}, true)`;
      await tx`select set_config('app.invitation_email', ${invitationEmail}, true)`;
      const invitations = await tx<{ id: string }[]>`
        select id from tenant_invitations where id = ${invitationId}
      `;
      if (invitations.length !== 1) throw new Error("RLS_INVITATION_LOOKUP_FAILED");
      await tx`select set_config('app.invitation_email', 'wrong@example.test', true)`;
      const wrongInvitations = await tx<{ id: string }[]>`
        select id from tenant_invitations where id = ${invitationId}
      `;
      if (wrongInvitations.length !== 0) {
        throw new Error("RLS_INVITATION_LOOKUP_LEAK");
      }

      await tx`select set_config('app.current_tenant_id', ${tenantA}, true)`;
      const visibleA = await tx<{ id: string }[]>`
        select id from crm_tags where id in (${tagA}, ${tagB}) order by id
      `;
      if (visibleA.length !== 1 || visibleA[0].id !== tagA) {
        throw new Error("RLS_TENANT_A_SELECT_FAILED");
      }

      let crossInsertBlocked = false;
      await tx
        .savepoint(async (savepoint) => {
          await savepoint`
            insert into crm_tags (id, tenant_id, name, name_normalized, created_by_user_id)
            values (${`rls-cross-${suffix}`}, ${tenantB}, 'Cross', ${`rls-cross-${suffix}`}, ${userA})
          `;
        })
        .catch((error: unknown) => {
          if ((error as { code?: string }).code !== "42501") throw error;
          crossInsertBlocked = true;
        });
      if (!crossInsertBlocked) throw new Error("RLS_CROSS_INSERT_ACCEPTED");

      let crossUpdateBlocked = false;
      await tx
        .savepoint(async (savepoint) => {
          await savepoint`
            update crm_tags set tenant_id = ${tenantB} where id = ${tagA}
          `;
        })
        .catch((error: unknown) => {
          if ((error as { code?: string }).code !== "42501") throw error;
          crossUpdateBlocked = true;
        });
      if (!crossUpdateBlocked) throw new Error("RLS_CROSS_UPDATE_ACCEPTED");

      const deleted = await tx<{ id: string }[]>`
        delete from crm_tags where id = ${tagB} returning id
      `;
      if (deleted.length !== 0) throw new Error("RLS_CROSS_DELETE_ACCEPTED");

      await tx`select set_config('app.current_tenant_id', ${tenantB}, true)`;
      const visibleB = await tx<{ id: string }[]>`
        select id from crm_tags where id in (${tagA}, ${tagB}) order by id
      `;
      if (visibleB.length !== 1 || visibleB[0].id !== tagB) {
        throw new Error("RLS_TENANT_B_SELECT_FAILED");
      }

      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }

  const [settings] = await runtime<
    { tenantId: string | null; userId: string | null; invitationHash: string | null }[]
  >`
    select
      nullif(current_setting('app.current_tenant_id', true), '') as "tenantId",
      nullif(current_setting('app.current_user_id', true), '') as "userId",
      nullif(current_setting('app.invitation_token_hash', true), '') as "invitationHash"
  `;
  if (settings.tenantId || settings.userId || settings.invitationHash) {
    throw new Error("RLS_CONTEXT_LEAK_AFTER_TRANSACTION");
  }
}

try {
  await auditD01SessionCapabilities();
  const tables = await auditCatalog();
  const readableTables = await auditNoContext(tables);
  const workerReadableTables = await auditWorkerNoContext(tables);
  await auditTenantBehavior();
  console.log(
    `RLS audit passed: ${tables.length} tenant tables, ${readableTables} runtime-readable tables, ${workerReadableTables} worker-readable tables, behavioral isolation and D-01 capabilities verified.`,
  );
} finally {
  await Promise.all([
    catalog.end({ timeout: 2 }),
    runtime.end({ timeout: 2 }),
    worker.end({ timeout: 2 }),
  ]);
}
