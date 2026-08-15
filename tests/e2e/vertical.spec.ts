import { expect, test, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";

const password = "E2E-password-long-enough-123";
const appURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const mailpitURL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const execFileAsync = promisify(execFile);
const testMigrationURL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";
const testRuntimeURL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://crm_runtime:crm_runtime_password@127.0.0.1:5433/crm_test";
const testWorkerURL =
  process.env.TEST_DATABASE_WORKER_URL ??
  "postgresql://crm_worker:crm_worker_password@127.0.0.1:5433/crm_test";

async function clearMailpit(request: APIRequestContext) {
  await request.delete(`${mailpitURL}/api/v1/messages`);
}

async function resetE2eDatabase() {
  const sql = postgres(testMigrationURL, { prepare: false });
  await sql.begin(async (tx) => {
    await tx`truncate public_otp_delivery_jobs`;
    await tx`truncate agreement_internal_reviews, agreement_template_versions, agreement_templates, agreement_clause_versions, agreement_clause_blocks, agreement_review_policies, agreement_acceptance_actions, agreement_evidence_bundles, agreement_external_execution_records, agreement_public_sessions, agreement_recipient_links, agreement_recipients, agreement_envelopes, agreement_versions, agreement_drafts, agreement_outbox_events, agreements, agreement_number_sequences, quote_email_challenges, quote_client_decisions, quote_draft_sections, quote_draft_items, quote_drafts, commercial_tax_rates, quote_public_sessions, quote_items, quote_public_links, quote_versions, quotes, quote_number_sequences, inbox_message_status_events, inbox_attachments, inbox_messages, inbox_conversation_notes, inbox_conversation_reads, inbox_conversation_assignments, inbox_conversations, inbox_channel_identities, inbox_integration_jobs, inbox_webhook_receipts, inbox_webhook_routes, inbox_forms, integration_secret_values, inbox_connections, sales_activities, sales_domain_events, sales_lead_sources, sales_lost_reasons, sales_opportunity_participants, sales_stage_history, sales_state_history, sales_opportunities, sales_pipeline_stages, sales_pipelines, crm_commercial_audit_events, crm_communication_consent_events, crm_contact_tags, crm_account_tags, crm_contact_notes, crm_account_notes, crm_contact_methods, crm_account_contacts, crm_contacts, crm_accounts, crm_tags, payment_secret_values, mercado_pago_profiles, stripe_profiles, paypal_profiles, oauth_authorization_attempts, payment_provider_events, payment_attempts, payment_adjustments, payment_allocations, payment_records, payment_requests, payment_connections, receivable_installments, deposit_requirements, receivable_plans, portal_access_project_scopes, portal_accesses, portal_brand_profiles, portal_deliverable_decisions, portal_deliverable_versions, portal_deliverables, portal_domains, portal_invitations, portal_messages, portal_outbox_events, portal_project_conversations, project_activation_approvals, project_activation_policies, project_activations, project_number_sequences, project_outbox_events, project_phases, project_plan_versions, project_task_checklist_items, project_task_dependencies, project_tasks, project_template_selection_rules, project_template_versions, project_templates, projects cascade`;
    await tx`truncate security_audit_events, tenant_membership_roles, tenant_invitation_roles, tenant_memberships, tenant_invitations, tenants, platform_administrators, session, account, verification, "twoFactor", "user" cascade`;
  });
  await sql.end({ timeout: 2 });
}

async function createVerifiedUser(
  request: APIRequestContext,
  name: string,
): Promise<{ email: string; link: string }> {
  const email = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const signup = await request.post(`${appURL}/api/auth/sign-up/email`, {
    data: { name, email, password, callbackURL: `${appURL}/verify-email` },
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

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function verifyUser(
  page: import("@playwright/test").Page,
  user: { link: string },
) {
  await page.goto(user.link);
  await expect(page).toHaveURL(/\/verify-email/);
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
        DATABASE_URL: testRuntimeURL,
        BETTER_AUTH_SECRET: "test".repeat(8),
        BETTER_AUTH_URL: appURL,
        APP_BASE_URL: appURL,
        PLATFORM_ADMIN_BOOTSTRAP_ENABLED: "true",
        PLATFORM_ADMIN_EMAIL: email,
      },
    },
  );
}

async function findInvitationLink(
  request: APIRequestContext,
  email: string,
): Promise<string> {
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

async function acceptInvitation(page: import("@playwright/test").Page, link: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Aceptar invitacion" }).click();
}

type PublicCookieJar = {
  session?: string;
  csrf?: string;
};

async function exchangeQuote(
  request: APIRequestContext,
  token: string,
): Promise<PublicCookieJar> {
  const response = await request.post(`${appURL}/api/public/quotes/exchange`, {
    data: { token },
  });
  expect(response.status()).toBe(200);
  const state = await request.storageState();
  const cookies = state.cookies.filter(
    (cookie) =>
      cookie.name === "quote_public_session" || cookie.name === "quote_public_csrf",
  );
  return {
    session: cookies.find((cookie) => cookie.name === "quote_public_session")?.value,
    csrf: cookies.find((cookie) => cookie.name === "quote_public_csrf")?.value,
  };
}

async function verifyQuoteOtp(request: APIRequestContext) {
  const requestOtp = await request.post(`${appURL}/api/public/quotes/otp`, {
    data: { action: "request" },
  });
  expect(requestOtp.ok()).toBeTruthy();
  const otpData = (await requestOtp.json()) as { testCode?: string };
  const verify = await request.post(`${appURL}/api/public/quotes/otp`, {
    data: { action: "verify", code: otpData.testCode },
  });
  expect(verify.ok()).toBeTruthy();
}

async function runIntegrationWorkerOnce() {
  await execFileAsync(
    process.execPath,
    ["--import", "tsx", "scripts/integration-worker.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testRuntimeURL,
        DATABASE_WORKER_URL: testWorkerURL,
        BETTER_AUTH_SECRET: "test".repeat(8),
        BETTER_AUTH_URL: appURL,
        APP_BASE_URL: appURL,
        INTEGRATION_WORKER_RUN_ONCE: "true",
      },
    },
  );
}

test.beforeEach(async ({ request }) => {
  await resetE2eDatabase();
  await clearMailpit(request);
});

test("commercial vertical: won opportunity produces an activated project visible on the client portal", async ({
  page,
  request,
  browser,
  playwright,
}) => {
  test.setTimeout(180_000);
  const platform = await createVerifiedUser(request, "plataforma");
  await verifyUser(page, platform);
  await bootstrapPlatformAdmin(platform.email);

  await clearMailpit(request);
  const aliceIdentity = await createVerifiedUser(request, "alice");
  await verifyUser(page, aliceIdentity);
  await clearMailpit(request);
  const bobIdentity = await createVerifiedUser(request, "bob");
  await verifyUser(page, bobIdentity);
  await clearMailpit(request);
  const clientIdentity = await createVerifiedUser(request, "cliente");
  await verifyUser(page, clientIdentity);
  await clearMailpit(request);

  await login(page, platform.email, password);
  const tenantResponse = await page.request.post("/api/platform/tenants", {
    data: {
      displayName: "Agencia Piloto",
      slug: `agencia-piloto-${Date.now()}`,
      adminEmail: aliceIdentity.email,
    },
  });
  expect(tenantResponse.status()).toBe(201);
  const tenantData = (await tenantResponse.json()) as {
    tenant: { id: string; slug: string };
  };
  const aliceInvitation = await findInvitationLink(request, aliceIdentity.email);
  await clearMailpit(request);

  const aliceContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  await login(alice, aliceIdentity.email, password);
  await alice.goto(aliceInvitation);
  await alice.getByRole("button", { name: "Aceptar invitacion" }).click();
  await expect(alice).toHaveURL(new RegExp(`/app/${tenantData.tenant.slug}`));
  await clearMailpit(request);

  await alice.request.post(`/api/tenants/${tenantData.tenant.slug}/members`, {
    data: { email: bobIdentity.email, roles: ["finance"] },
  });
  await alice.request.post(`/api/tenants/${tenantData.tenant.slug}/members`, {
    data: { email: clientIdentity.email, roles: ["client"] },
  });

  const bobInvitation = await findInvitationLink(request, bobIdentity.email);
  const clientInvitation = await findInvitationLink(request, clientIdentity.email);
  await clearMailpit(request);

  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await login(bob, bobIdentity.email, password);
  await acceptInvitation(bob, bobInvitation);
  await expect(bob).toHaveURL(new RegExp(`/app/${tenantData.tenant.slug}`));

  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await login(client, clientIdentity.email, password);
  await acceptInvitation(client, clientInvitation);
  await expect(client).toHaveURL(new RegExp(`/portal/${tenantData.tenant.slug}`));

  const members = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/members`,
  );
  expect(members.ok()).toBeTruthy();
  const memberData = (await members.json()) as {
    members: Array<{ membershipId: string; email: string }>;
  };
  const aliceMembership = memberData.members.find(
    (member) => member.email === aliceIdentity.email,
  );
  const bobMembership = memberData.members.find(
    (member) => member.email === bobIdentity.email,
  );
  expect(aliceMembership).toBeTruthy();
  expect(bobMembership).toBeTruthy();

  const pipelines = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/sales/pipelines`,
  );
  expect(pipelines.ok()).toBeTruthy();
  const pipelineData = (await pipelines.json()) as {
    pipelines: Array<{
      id: string;
      stages: Array<{ id: string; isInitial: boolean }>;
    }>;
  };
  const pipeline = pipelineData.pipelines[0];
  expect(pipeline).toBeTruthy();
  const initialStage = pipeline.stages.find((stage) => stage.isInitial);

  const account = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/accounts`,
    {
      data: {
        displayName: "Corporativo México",
        website: "https://corpo.example.test",
      },
    },
  );
  expect(account.status()).toBe(201);
  const accountData = (await account.json()) as { account: { id: string } };
  const contact = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/crm/contacts`,
    {
      data: {
        displayName: "Carlos Rivera",
        methods: [
          {
            type: "email",
            value: clientIdentity.email,
            label: "work",
            isPrimary: true,
          },
        ],
      },
    },
  );
  expect(contact.status()).toBe(201);
  const contactData = (await contact.json()) as { contact: { id: string } };

  const opportunity = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/sales/opportunities`,
    {
      data: {
        title: "Rediseño web corporativo",
        pipelineId: pipeline.id,
        stageId: initialStage?.id,
        primaryContactId: contactData.contact.id,
        accountId: accountData.account.id,
        ownerMembershipId: aliceMembership!.membershipId,
        pricingModel: "fixed_price",
        currency: "MXN",
        estimatedValueMinor: 1_500_000,
      },
    },
  );
  expect(opportunity.status()).toBe(201);
  const opportunityData = (await opportunity.json()) as {
    opportunity: { id: string; version: number };
  };

  const quote = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/quotes`,
    {
      data: {
        title: "Cotización rediseño web",
        currency: "MXN",
        accountId: accountData.account.id,
        contactId: contactData.contact.id,
        opportunityId: opportunityData.opportunity.id,
        lines: [
          {
            description: "Rediseño web corporativo",
            quantity: "1",
            unitPriceMinor: "1500000",
            discount: { type: "none", value: "0" },
            taxRateBps: "0",
          },
        ],
      },
    },
  );
  expect(quote.status()).toBe(201);
  const quoteData = (await quote.json()) as { quote: { id: string } };

  const issued = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/quotes/${quoteData.quote.id}/issue`,
  );
  expect(issued.ok()).toBeTruthy();

  const link = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/quotes/${quoteData.quote.id}/public-link`,
  );
  expect(link.status()).toBe(201);
  const linkData = (await link.json()) as { token: string };
  expect(linkData.token).toBeTruthy();

  const clientQuoteRequest = await playwright.request.newContext({
    baseURL: appURL,
    extraHTTPHeaders: { Origin: new URL(appURL).origin },
  });
  await exchangeQuote(clientQuoteRequest, linkData.token);
  const publicQuote = await clientQuoteRequest.get(
    `${appURL}/api/public/quotes/current`,
  );
  expect(publicQuote.ok()).toBeTruthy();
  const publicQuoteData = (await publicQuote.json()) as {
    quote: { totalMinor: string; taxMinor: string; tenantId?: string; id?: string };
    items: Array<{ totalMinor: string; unitPriceMinor: string }>;
  };
  expect(typeof publicQuoteData.quote.totalMinor).toBe("string");
  expect(typeof publicQuoteData.quote.taxMinor).toBe("string");
  expect(typeof publicQuoteData.items[0]?.unitPriceMinor).toBe("string");
  expect(publicQuoteData.quote).not.toHaveProperty("tenantId");
  expect(publicQuoteData.quote).not.toHaveProperty("id");
  const quotePdf = await clientQuoteRequest.get(`${appURL}/api/public/quotes/pdf`);
  expect(quotePdf.ok()).toBeTruthy();
  expect(quotePdf.headers()["content-type"]).toContain("application/pdf");
  expect(quotePdf.headers()["content-disposition"]).toContain("attachment");
  expect(quotePdf.headers()["cache-control"]).toBe("private, no-store");
  expect(quotePdf.headers()["referrer-policy"]).toBe("no-referrer");
  const quotePdfBytes = await quotePdf.body();
  expect(quotePdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  await verifyQuoteOtp(clientQuoteRequest);
  const quoteCsrfToken = (await clientQuoteRequest.storageState()).cookies.find(
    (cookie) => cookie.name === "quote_public_csrf",
  )?.value;
  expect(quoteCsrfToken).toBeTruthy();
  const missingQuoteCsrf = await clientQuoteRequest.post(
    `${appURL}/api/public/quotes/decision`,
    {
      data: {
        decision: "accepted",
        fullName: "Carlos Rivera",
        consent: true,
        idempotencyKey: `missing-csrf-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(missingQuoteCsrf.status()).toBe(400);
  const decision = await clientQuoteRequest.post(
    `${appURL}/api/public/quotes/decision`,
    {
      data: {
        decision: "accepted",
        fullName: "Carlos Rivera",
        consent: true,
        csrfToken: quoteCsrfToken,
        idempotencyKey: `dec-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(decision.ok()).toBeTruthy();
  await clientQuoteRequest.dispose();

  const won = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/sales/opportunities/${opportunityData.opportunity.id}/transition`,
    {
      data: {
        version: opportunityData.opportunity.version,
        state: "won",
        finalValueMinor: 1_500_000,
      },
    },
  );
  expect(won.ok()).toBeTruthy();

  await runIntegrationWorkerOnce();

  const projects = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/projects`,
  );
  expect(projects.ok()).toBeTruthy();
  const projectsData = (await projects.json()) as {
    projects: Array<{
      id: string;
      opportunityId: string;
      status: string;
      quoteId: string | null;
      activationPolicyVersionId: string | null;
    }>;
  };
  const project = projectsData.projects.find(
    (entry) => entry.opportunityId === opportunityData.opportunity.id,
  );
  expect(project).toBeTruthy();
  expect(project!.quoteId).toBe(quoteData.quote.id);
  expect(project!.activationPolicyVersionId).toBeTruthy();

  const projectDetail = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
  );
  expect(projectDetail.ok()).toBeTruthy();
  const projectDetailData = (await projectDetail.json()) as {
    project: { activationPolicyVersionId: string };
  };

  const template = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/project-templates`,
    {
      data: {
        name: "Plantilla rediseño web",
        activationPolicyId: projectDetailData.project.activationPolicyVersionId,
        commercialModels: ["fixed_price"],
      },
    },
  );
  expect(template.status()).toBe(201);
  const templateData = (await template.json()) as { id: string };

  const publish = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/project-templates`,
    {
      data: {
        templateId: templateData.id,
        content: {
          phases: [
            { key: "kickoff", name: "Arranque", order: 1 },
            { key: "design", name: "Diseño", order: 2 },
            { key: "build", name: "Construcción", order: 3 },
          ],
          tasks: [
            {
              key: "brief",
              phaseKey: "kickoff",
              title: "Levantar brief",
              description: "Reunión de arranque",
              priority: "high",
            },
            {
              key: "wireframes",
              phaseKey: "design",
              title: "Entregar wireframes",
              priority: "normal",
            },
            {
              key: "build-home",
              phaseKey: "build",
              title: "Construir home",
              dependencies: ["wireframes"],
              priority: "normal",
            },
          ],
        },
      },
    },
  );
  expect(publish.status()).toBe(201);

  const selectTemplate = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
    {
      data: { action: "select_template", templateId: templateData.id },
    },
  );
  expect(selectTemplate.ok()).toBeTruthy();

  const agreement = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/agreements`,
    {
      data: {
        title: "Acuerdo servicios rediseño web",
        agreementType: "fixed_project_service_agreement",
        quoteId: quoteData.quote.id,
        provider: {
          name: "Agencia Piloto",
          email: aliceIdentity.email,
          role: "Agencia",
        },
        customer: {
          name: "Carlos Rivera",
          email: clientIdentity.email,
          role: "Cliente",
        },
      },
    },
  );
  expect(agreement.status()).toBe(201);
  const agreementData = (await agreement.json()) as {
    agreement: { id: string };
  };

  const issuedAgreement = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/agreements/${agreementData.agreement.id}/issue`,
    {
      data: {
        method: "internal_electronic_acceptance",
        signingOrder: "provider_first",
      },
    },
  );
  expect(issuedAgreement.ok()).toBeTruthy();
  const issuedAgreementData = (await issuedAgreement.json()) as {
    agreement: { publicTokens: string[]; agreementId: string };
  };
  const publicToken = issuedAgreementData.agreement.publicTokens[0];
  expect(publicToken).toBeTruthy();

  const internalAccept = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/agreements/${agreementData.agreement.id}/internal-accept`,
    {
      data: {
        fullName: "Alicia del Val",
        idempotencyKey: `sig-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(internalAccept.ok()).toBeTruthy();

  const clientAgreementRequest = await playwright.request.newContext({
    baseURL: appURL,
    extraHTTPHeaders: { Origin: new URL(appURL).origin },
  });
  const exchangeAgreementResponse = await clientAgreementRequest.post(
    `${appURL}/api/public/agreements/exchange`,
    { data: { token: publicToken } },
  );
  expect(exchangeAgreementResponse.status()).toBe(200);
  const requestAgreementOtp = await clientAgreementRequest.post(
    `${appURL}/api/public/agreements/otp`,
    { data: { action: "request" } },
  );
  expect(requestAgreementOtp.ok()).toBeTruthy();
  const agreementOtpData = (await requestAgreementOtp.json()) as { testCode?: string };
  expect(agreementOtpData.testCode).toBeTruthy();
  const verifyAgreementOtp = await clientAgreementRequest.post(
    `${appURL}/api/public/agreements/otp`,
    { data: { action: "verify", code: agreementOtpData.testCode } },
  );
  expect(verifyAgreementOtp.ok()).toBeTruthy();
  const agreementCsrfToken = (await clientAgreementRequest.storageState()).cookies.find(
    (cookie) => cookie.name === "agreement_public_csrf",
  )?.value;
  expect(agreementCsrfToken).toBeTruthy();
  const mismatchedAgreementCsrf = await clientAgreementRequest.post(
    `${appURL}/api/public/agreements/action`,
    {
      data: {
        action: "accepted",
        fullName: "Carlos Rivera",
        declaredAuthority: true,
        consent: true,
        csrfToken: "csrf-token-that-does-not-match",
        idempotencyKey: `mismatched-csrf-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(mismatchedAgreementCsrf.status()).toBe(400);
  const agreeAction = await clientAgreementRequest.post(
    `${appURL}/api/public/agreements/action`,
    {
      data: {
        action: "accepted",
        fullName: "Carlos Rivera",
        declaredAuthority: true,
        consent: true,
        csrfToken: agreementCsrfToken,
        idempotencyKey: `acc-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(agreeAction.ok()).toBeTruthy();
  const agreeActionData = (await agreeAction.json()) as {
    signaturesComplete: boolean;
  };
  expect(agreeActionData.signaturesComplete).toBe(true);
  await clientAgreementRequest.dispose();

  const plan = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/payments/plans`,
    { data: { sourceKind: "accepted_quote", sourceId: quoteData.quote.id } },
  );
  expect(plan.ok()).toBeTruthy();
  const planData = (await plan.json()) as { id: string; installmentId: string };

  const planDetail = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/payments/plans/${planData.id}`,
  );
  expect(planDetail.ok()).toBeTruthy();
  const planDetailData = (await planDetail.json()) as {
    plan: { status: string };
    installments: Array<{ id: string; amountMinor: string; status: string }>;
  };
  expect(planDetailData.plan.status).toBe("draft");
  const installment = planDetailData.installments[0];
  expect(installment).toBeTruthy();

  const openPlan = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/payments/plans/${planData.id}`,
  );
  expect(openPlan.ok()).toBeTruthy();

  const manualPayment = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/payments/manual`,
    {
      data: {
        planId: planData.id,
        installmentId: installment.id,
        amountMinor: installment.amountMinor,
        currency: "MXN",
        paidAt: new Date().toISOString(),
        method: "manual_transfer",
        idempotencyKey: `pay-${crypto.randomUUID().replace(/-/g, "")}`,
        institution: "Banco Piloto",
        referenceMasked: "TRA123",
      },
    },
  );
  expect(manualPayment.ok()).toBeTruthy();
  const manualPaymentData = (await manualPayment.json()) as {
    submission: { id: string };
  };

  const review = await bob.request.post(
    `/api/tenants/${tenantData.tenant.slug}/payments/manual/${manualPaymentData.submission.id}/review`,
    { data: { decision: "approve" } },
  );
  expect(review.ok()).toBeTruthy();
  expect(await review.json()).toMatchObject({ status: "approved" });

  const requestActivation = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
    {
      data: {
        action: "request_activation",
        idempotencyKey: `act-${crypto.randomUUID().replace(/-/g, "")}`,
      },
    },
  );
  expect(requestActivation.ok()).toBeTruthy();
  const requestActivationData = (await requestActivation.json()) as {
    approval: { id: string };
  };

  const decideApproval = await bob.request.post(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
    {
      data: {
        action: "decide_approval",
        approvalId: requestActivationData.approval.id,
        decision: "approved",
      },
    },
  );
  expect(decideApproval.ok()).toBeTruthy();

  const activate = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
    { data: { action: "activate" } },
  );
  expect(activate.ok()).toBeTruthy();
  const activateData = (await activate.json()) as {
    project: { number: string; status: string; id: string };
  };
  expect(activateData.project.status).toBe("active");
  expect(activateData.project.number).toMatch(/^PRJ-\d{4}-\d+$/);

  const activatedDetail = await alice.request.get(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}`,
  );
  expect(activatedDetail.ok()).toBeTruthy();
  const activatedDetailData = (await activatedDetail.json()) as {
    project: { status: string; number: string };
    tasks: Array<{ id: string; status: string; title: string }>;
  };
  expect(activatedDetailData.project.status).toBe("active");
  expect(activatedDetailData.tasks.length).toBeGreaterThan(0);
  const firstTask = activatedDetailData.tasks[0];

  const moveTask = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/projects/${project!.id}/tasks`,
    {
      data: { action: "move_status", taskId: firstTask.id, status: "in_progress" },
    },
  );
  expect(moveTask.ok()).toBeTruthy();

  const portalInvitation = await alice.request.post(
    `/api/tenants/${tenantData.tenant.slug}/portal/invitations`,
    {
      data: {
        accountId: accountData.account.id,
        contactId: contactData.contact.id,
        email: clientIdentity.email,
        expiresInDays: 7,
      },
    },
  );
  expect(portalInvitation.status()).toBe(201);
  const portalInvitationData = (await portalInvitation.json()) as {
    token: string;
  };

  const acceptPortal = await client.request.post(
    `/api/portal/${tenantData.tenant.slug}/invitations/${portalInvitationData.token}/accept`,
  );
  expect(acceptPortal.ok()).toBeTruthy();

  await client.goto(`/portal/${tenantData.tenant.slug}`);
  await expect(client.getByText("Portal del cliente preparado.")).toBeVisible();
  await expect(
    client.getByRole("heading", { name: "Rediseño web corporativo" }),
  ).toBeVisible();

  await client.goto(`/portal/${tenantData.tenant.slug}/projects/${project!.id}`);
  await expect(client.getByText("Avance general")).toBeVisible();
  await expect(client.getByText(/^\d+%$/)).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
  await clientContext.close();
});
