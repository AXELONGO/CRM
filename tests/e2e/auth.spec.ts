import { expect, test, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";

const password = "E2E-password-long-enough-123";
const appURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const mailpitURL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const execFileAsync = promisify(execFile);
const testDatabaseURL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";

async function clearMailpit(request: APIRequestContext) {
  await request.delete(`${mailpitURL}/api/v1/messages`);
}

async function resetE2eDatabase() {
  const sql = postgres(testDatabaseURL, { prepare: false });
  await sql.begin(async (tx) => {
    await tx`truncate public_otp_delivery_jobs`;
    await tx`truncate agreement_internal_reviews, agreement_template_versions, agreement_templates, agreement_clause_versions, agreement_clause_blocks, agreement_review_policies, agreement_acceptance_actions, agreement_evidence_bundles, agreement_external_execution_records, agreement_public_sessions, agreement_recipient_links, agreement_recipients, agreement_envelopes, agreement_versions, agreement_drafts, agreement_outbox_events, agreements, agreement_number_sequences, quote_email_challenges, quote_client_decisions, quote_draft_sections, quote_draft_items, quote_drafts, commercial_tax_rates, quote_public_sessions, quote_items, quote_public_links, quote_versions, quotes, quote_number_sequences, inbox_message_status_events, inbox_attachments, inbox_messages, inbox_conversation_notes, inbox_conversation_reads, inbox_conversation_assignments, inbox_conversations, inbox_channel_identities, inbox_integration_jobs, inbox_webhook_receipts, inbox_webhook_routes, inbox_forms, integration_secret_values, inbox_connections, sales_activities, sales_domain_events, sales_lead_sources, sales_lost_reasons, sales_opportunity_participants, sales_stage_history, sales_state_history, sales_opportunities, sales_pipeline_stages, sales_pipelines, crm_commercial_audit_events, crm_communication_consent_events, crm_contact_tags, crm_account_tags, crm_contact_notes, crm_account_notes, crm_contact_methods, crm_account_contacts, crm_contacts, crm_accounts, crm_tags, payment_secret_values, mercado_pago_profiles, stripe_profiles, paypal_profiles, oauth_authorization_attempts, payment_provider_events, payment_attempts, payment_adjustments, payment_allocations, payment_records, payment_requests, payment_connections, receivable_installments, deposit_requirements, receivable_plans cascade`;
    await tx`truncate security_audit_events, tenant_membership_roles, tenant_invitation_roles, tenant_memberships, tenant_invitations, tenants, platform_administrators, session, account, verification, "twoFactor", "user" cascade`;
  });
  await sql.end({ timeout: 2 });
}

async function createVerifiedUser(request: APIRequestContext) {
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const signup = await request.post(`${appURL}/api/auth/sign-up/email`, {
    data: { name: "E2E User", email, password, callbackURL: `${appURL}/verify-email` },
    headers: { "x-crm-bootstrap": "true" },
  });
  expect(signup.ok()).toBeTruthy();

  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await request.get(`${mailpitURL}/api/v1/messages?limit=50`);
        const messages = (await list.json()) as { messages?: Array<{ ID: string }> };
        for (const message of messages.messages ?? []) {
          const detail = await request.get(
            `${mailpitURL}/api/v1/message/${message.ID}`,
          );
          const body = (await detail.json()) as { Text?: string; HTML?: string };
          const content = `${body.Text ?? ""}\n${body.HTML ?? ""}`;
          const match = content.match(
            /https?:\/\/[^\s"<]+\/api\/auth\/verify-email[^\s"<]*/,
          );
          if (match) {
            link = match[0].replace(/&amp;/g, "&");
            return true;
          }
        }
        return false;
      },
      { timeout: 10_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);

  return { email, link: link as string };
}

async function verifyUser(
  page: import("@playwright/test").Page,
  user: { link: string },
) {
  await page.goto(user.link);
  await expect(page).toHaveURL(/\/verify-email/);
}

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function bootstrapPlatformAdmin(email: string) {
  await execFileAsync(
    process.execPath,
    ["--import", "tsx", "scripts/bootstrap-platform-admin.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          "postgresql://crm_runtime:crm_runtime_password@127.0.0.1:5433/crm_test",
        BETTER_AUTH_SECRET: "test".repeat(8),
        BETTER_AUTH_URL: appURL,
        APP_BASE_URL: appURL,
        PLATFORM_ADMIN_BOOTSTRAP_ENABLED: "true",
        PLATFORM_ADMIN_EMAIL: email,
      },
    },
  );
}

async function findInvitationLink(request: APIRequestContext, email: string) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await request.get(`${mailpitURL}/api/v1/messages?limit=50`);
        const messages = (await list.json()) as { messages?: Array<{ ID: string }> };
        for (const message of messages.messages ?? []) {
          const detail = await request.get(
            `${mailpitURL}/api/v1/message/${message.ID}`,
          );
          const body = (await detail.json()) as {
            To?: Array<{ Address: string }>;
            Text?: string;
            HTML?: string;
          };
          if (!body.To?.some((recipient) => recipient.Address === email)) continue;
          const content = `${body.Text ?? ""}\n${body.HTML ?? ""}`;
          const match = content.match(/https?:\/\/[^\s"<]+\/invite\/[^\s"<]*/);
          if (match) {
            link = match[0].replace(/&amp;/g, "&");
            return true;
          }
        }
        return false;
      },
      { timeout: 10_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
  return link as string;
}

test.beforeEach(async ({ request }) => {
  await resetE2eDatabase();
  await clearMailpit(request);
});

test("anonymous users are redirected and invalid credentials stay generic", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);

  await page.getByLabel("Correo").fill("nobody@example.test");
  await page.getByLabel("Contrasena").fill("wrong-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("No se pudo iniciar sesion.")).toBeVisible();
});

test("recovery confirmation is identical for known and unknown emails", async ({
  page,
  request,
}) => {
  const user = await createVerifiedUser(request);
  await clearMailpit(request);
  await page.goto("/forgot-password");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  const confirmation = await page.getByRole("status").textContent();

  await page.goto("/forgot-password");
  await page.getByLabel("Correo").fill("unknown@example.test");
  await page.getByRole("button", { name: "Enviar instrucciones" }).click();
  await expect(page.getByRole("status")).toHaveText(confirmation ?? "");
});

test("a recovery link updates the password and the new password works", async ({
  page,
  request,
}) => {
  const user = await createVerifiedUser(request);
  await page.goto(user.link);
  await expect(page).toHaveURL(/\/verify-email/);
  await clearMailpit(request);

  const resetRequest = await request.post(`${appURL}/api/auth/request-password-reset`, {
    data: { email: user.email, redirectTo: `${appURL}/reset-password` },
  });
  expect(resetRequest.ok()).toBeTruthy();

  let resetLink: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await request.get(`${mailpitURL}/api/v1/messages?limit=50`);
        const messages = (await list.json()) as { messages?: Array<{ ID: string }> };
        for (const message of messages.messages ?? []) {
          const detail = await request.get(
            `${mailpitURL}/api/v1/message/${message.ID}`,
          );
          const body = (await detail.json()) as { Text?: string; HTML?: string };
          const content = `${body.Text ?? ""}\n${body.HTML ?? ""}`;
          const match = content.match(
            /https?:\/\/[^\s"<]+\/api\/auth\/reset-password[^\s"<]*/,
          );
          if (match) {
            resetLink = match[0].replace(/&amp;/g, "&");
            return true;
          }
        }
        return false;
      },
      { timeout: 10_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);

  await page.goto(resetLink as string);
  await page.getByLabel("Nueva contrasena").fill("E2E-new-password-long-123");
  await page.getByLabel("Confirmar contrasena").fill("E2E-new-password-long-123");
  await page.getByRole("button", { name: "Actualizar contrasena" }).click();
  await expect(page.getByRole("status")).toContainText("actualizada");

  await page.goto("/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contrasena").fill("E2E-new-password-long-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("verified user can log in, access the protected page, and log out", async ({
  page,
  request,
}) => {
  const user = await createVerifiedUser(request);
  await page.goto(user.link);
  await expect(page).toHaveURL(/\/verify-email/);

  await page.goto("/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Sesion autenticada" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesion" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});

test("external next redirects are rejected and registration is absent", async ({
  page,
}) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await expect(page).toHaveURL(/\/login\?next=https%3A%2F%2Fevil.example/);
  await expect(page.locator("a[href='/register']")).toHaveCount(0);
  expect((await page.request.get("/register")).status()).toBe(404);
  const directSignup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "No Invite", email: "no-invite@example.test", password },
  });
  expect(directSignup.status()).toBe(403);
});

test("platform, tenant membership, invitations, and cross-tenant isolation work together", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(60_000);
  await clearMailpit(request);
  const platformIdentity = await createVerifiedUser(request);
  await verifyUser(page, platformIdentity);
  await bootstrapPlatformAdmin(platformIdentity.email);

  await clearMailpit(request);
  const aIdentity = await createVerifiedUser(request);
  await verifyUser(page, aIdentity);
  await clearMailpit(request);
  const bIdentity = await createVerifiedUser(request);
  await verifyUser(page, bIdentity);
  await clearMailpit(request);
  const clientIdentity = await createVerifiedUser(request);
  await verifyUser(page, clientIdentity);

  await login(page, platformIdentity.email);
  const tenantA = await page.request.post("/api/platform/tenants", {
    data: {
      displayName: "Agencia Norte",
      slug: `agencia-norte-${Date.now()}`,
      adminEmail: aIdentity.email,
    },
  });
  expect(tenantA.status()).toBe(201);
  const tenantAData = (await tenantA.json()) as {
    tenant: { slug: string; id: string };
  };
  const invitationA = await findInvitationLink(request, aIdentity.email);

  await clearMailpit(request);
  const tenantB = await page.request.post("/api/platform/tenants", {
    data: {
      displayName: "Agencia Sur",
      slug: `agencia-sur-${Date.now()}`,
      adminEmail: bIdentity.email,
    },
  });
  expect(tenantB.status()).toBe(201);
  const tenantBData = (await tenantB.json()) as {
    tenant: { slug: string; id: string };
  };
  const invitationB = await findInvitationLink(request, bIdentity.email);

  const aliceContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  await login(alice, aIdentity.email);
  await alice.goto(invitationA);
  await alice.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(alice).toHaveURL(new RegExp(`/app/${tenantAData.tenant.slug}`));

  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await login(bob, bIdentity.email);
  await bob.goto(invitationB);
  await bob.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(bob).toHaveURL(new RegExp(`/app/${tenantBData.tenant.slug}`));

  await clearMailpit(request);
  const clientInvite = await alice.request.post(
    `/api/tenants/${tenantAData.tenant.slug}/members`,
    {
      data: { email: clientIdentity.email, roles: ["client"] },
    },
  );
  expect(clientInvite.status()).toBe(201);
  const clientInvitation = await findInvitationLink(request, clientIdentity.email);
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await login(client, clientIdentity.email);
  await client.goto(clientInvitation);
  await client.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(client).toHaveURL(new RegExp(`/portal/${tenantAData.tenant.slug}`));

  expect(
    (
      await client.request.get(`/api/tenants/${tenantBData.tenant.slug}/members`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(`/api/tenants/${tenantAData.tenant.slug}/members`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await client.request.get(`/api/tenants/${tenantAData.tenant.slug}/members`)
    ).status(),
  ).toBe(403);
  await client.goto(`/portal/${tenantAData.tenant.slug}`);
  await expect(client.getByText("Portal del cliente preparado.")).toBeVisible();

  const members = await alice.request.get(
    `/api/tenants/${tenantAData.tenant.slug}/members`,
  );
  const memberData = (await members.json()) as {
    members: Array<{ membershipId: string; email: string }>;
  };
  const clientMembership = memberData.members.find(
    (member) => member.email === clientIdentity.email,
  );
  const aliceMembership = memberData.members.find(
    (member) => member.email === aIdentity.email,
  );
  expect(clientMembership).toBeTruthy();
  expect(aliceMembership).toBeTruthy();

  expect(
    (
      await alice.request.post(
        `/api/tenants/${tenantAData.tenant.slug}/members/${aliceMembership?.membershipId}/status`,
        { data: { status: "suspended" } },
      )
    ).status(),
  ).toBe(409);
  expect(
    (
      await alice.request.post(
        `/api/tenants/${tenantAData.tenant.slug}/members/${clientMembership?.membershipId}/status`,
        { data: { status: "suspended" } },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await client.request.get(`/api/tenants/${tenantAData.tenant.slug}/members`)
    ).status(),
  ).toBe(403);

  expect(
    (
      await page.request.post(`/api/platform/tenants/${tenantBData.tenant.id}/status`, {
        data: { status: "suspended" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await bob.request.get(`/api/tenants/${tenantBData.tenant.slug}/members`)).status(),
  ).toBe(403);

  await aliceContext.close();
  await bobContext.close();
  await clientContext.close();
});

test("commercial directory supports contacts, accounts, duplicates, and direct cross-tenant denial", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(60_000);
  const platform = await createVerifiedUser(request);
  await verifyUser(page, platform);
  await bootstrapPlatformAdmin(platform.email);
  await clearMailpit(request);
  const aliceIdentity = await createVerifiedUser(request);
  await verifyUser(page, aliceIdentity);
  await clearMailpit(request);
  const bobIdentity = await createVerifiedUser(request);
  await verifyUser(page, bobIdentity);

  await login(page, platform.email);
  const tenantResponse = await page.request.post("/api/platform/tenants", {
    data: {
      displayName: "Directorio Norte",
      slug: `directorio-norte-${Date.now()}`,
      adminEmail: aliceIdentity.email,
    },
  });
  const tenantData = (await tenantResponse.json()) as {
    tenant: { id: string; slug: string };
  };
  const otherTenantResponse = await page.request.post("/api/platform/tenants", {
    data: {
      displayName: "Directorio Sur",
      slug: `directorio-sur-${Date.now()}`,
      adminEmail: bobIdentity.email,
    },
  });
  const otherTenantData = (await otherTenantResponse.json()) as {
    tenant: { slug: string };
  };
  const invitation = await findInvitationLink(request, aliceIdentity.email);
  const otherInvitation = await findInvitationLink(request, bobIdentity.email);

  const aliceContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  await login(alice, aliceIdentity.email);
  await alice.goto(invitation);
  await alice.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(alice).toHaveURL(new RegExp(`/app/${tenantData.tenant.slug}`));

  const account = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/accounts`,
    { data: { displayName: "Empresa Ámbar", website: "https://ambar.example.test" } },
  );
  expect(account.status()).toBe(201);
  const contact = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/contacts`,
    {
      data: {
        displayName: "María José O'Connor",
        methods: [
          {
            type: "email",
            value: "shared@example.test",
            label: "work",
            isPrimary: true,
          },
        ],
      },
    },
  );
  expect(contact.status()).toBe(201);
  const contactData = (await contact.json()) as { contact: { id: string } };
  const duplicateWarning = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/contacts`,
    {
      data: {
        displayName: "Otra Persona",
        methods: [
          {
            type: "email",
            value: "shared@example.test",
            label: "other",
            isPrimary: true,
          },
        ],
      },
    },
  );
  expect(duplicateWarning.status()).toBe(409);
  const duplicateConfirmed = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/contacts`,
    {
      data: {
        displayName: "Otra Persona",
        duplicateConfirmed: true,
        methods: [
          {
            type: "email",
            value: "shared@example.test",
            label: "other",
            isPrimary: true,
          },
        ],
      },
    },
  );
  expect(duplicateConfirmed.status()).toBe(201);
  expect(
    (
      await alice.request.get(
        `/api/tenants/${tenantData.tenant.slug}/crm/contacts?q=shared@example.test`,
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await alice.request.post(
        `/api/tenants/${tenantData.tenant.slug}/crm/contacts/${contactData.contact.id}/consent`,
        {
          data: {
            channel: "email",
            purpose: "marketing",
            status: "denied",
            source: "manual",
            occurredAt: new Date().toISOString(),
          },
        },
      )
    ).status(),
  ).toBe(201);

  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await login(bob, bobIdentity.email);
  await bob.goto(otherInvitation);
  await bob.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(bob).toHaveURL(new RegExp(`/app/${otherTenantData.tenant.slug}`));
  expect(
    (
      await bob.request.get(`/api/tenants/${tenantData.tenant.slug}/crm/contacts`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await bob.request.get(
        `/api/tenants/${tenantData.tenant.slug}/crm/contacts/${contactData.contact.id}`,
      )
    ).status(),
  ).toBe(404);
  await aliceContext.close();
  await bobContext.close();
});
