import { expect, test, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const appURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const mailpitURL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const password = "E2E-password-long-enough-123";
const migrationURL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";
const execFileAsync = promisify(execFile);

async function resetDatabase() {
  const sql = postgres(migrationURL, { prepare: false });
  await sql`truncate security_audit_events, tenant_membership_roles, tenant_invitation_roles, tenant_memberships, tenant_invitations, tenants, platform_administrators, session, account, verification, "twoFactor", "user" cascade`;
  await sql.end({ timeout: 2 });
}

async function clearMailpit(request: APIRequestContext) {
  await request.delete(`${mailpitURL}/api/v1/messages`);
}

async function createVerifiedUser(request: APIRequestContext) {
  const email = `mfa-${Date.now()}@example.test`;
  const signup = await request.post(`${appURL}/api/auth/sign-up/email`, {
    data: { name: "MFA User", email, password, callbackURL: `${appURL}/verify-email` },
    headers: { "x-crm-bootstrap": "true" },
  });
  expect(signup.ok()).toBeTruthy();

  let link: string | undefined;
  await expect
    .poll(async () => {
      const list = await request.get(`${mailpitURL}/api/v1/messages?limit=20`);
      const messages = (await list.json()) as { messages?: Array<{ ID: string }> };
      for (const message of messages.messages ?? []) {
        const detail = await request.get(`${mailpitURL}/api/v1/message/${message.ID}`);
        const body = (await detail.json()) as { Text?: string; HTML?: string };
        const match = `${body.Text ?? ""}\n${body.HTML ?? ""}`.match(
          /https?:\/\/[^\s"<]+\/api\/auth\/verify-email[^\s"<]*/,
        );
        if (match) {
          link = match[0].replace(/&amp;/g, "&");
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  return { email, link: link as string };
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
        PLATFORM_ADMIN_BOOTSTRAP_ENABLED: "true",
        PLATFORM_ADMIN_EMAIL: email,
      },
    },
  );
}

function decodeBase32(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("TOTP_SECRET_INVALID");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(uri: string): string {
  const url = new URL(uri);
  const secret = url.searchParams.get("secret");
  if (!secret) throw new Error("TOTP_SECRET_MISSING");
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, "0");
}

test.beforeEach(async ({ request }) => {
  await resetDatabase();
  await clearMailpit(request);
});

test("privileged account enrolls and completes a TOTP sign-in challenge", async ({
  page,
}) => {
  test.setTimeout(60_000);
  test.skip(
    process.env.E2E_MFA_ENFORCEMENT !== "true",
    "Run this dedicated flow with pnpm test:e2e:mfa.",
  );

  const identity = await createVerifiedUser(page.request);
  await page.goto(identity.link);
  await bootstrapPlatformAdmin(identity.email);

  await page.goto("/login");
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/security\/mfa$/);

  await page.getByLabel("Confirma tu contrasena").fill(password);
  await page.getByRole("button", { name: "Configurar autenticador" }).click();
  const totpURI = await page.locator("output").innerText();
  await page.getByLabel("3. Codigo de autenticacion").fill(currentTotp(totpURI));
  await page.getByRole("button", { name: "Activar MFA" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("button", { name: "Cerrar sesion" }).click();
  await page.getByLabel("Correo").fill(identity.email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByLabel("Codigo de autenticacion")).toBeVisible();

  const pendingSession = await page.request.get("/api/auth/get-session");
  expect(await pendingSession.json()).toBeNull();

  await page.getByLabel("Codigo de autenticacion").fill(currentTotp(totpURI));
  await page.getByRole("button", { name: "Verificar codigo" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Sesion autenticada" })).toBeVisible();
});
