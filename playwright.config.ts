import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const databaseURL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://crm_runtime:crm_runtime_password@127.0.0.1:5433/crm_test";
const migrationDatabaseURL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://crm_test_migration:crm_test_migration_password@127.0.0.1:5433/crm_test";
const ingressDatabaseURL =
  process.env.TEST_DATABASE_INGRESS_URL ??
  "postgresql://crm_ingress:crm_ingress_password@127.0.0.1:5433/crm_test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "pnpm auth:e2e-prepare && env -u DATABASE_MIGRATION_URL -u DATABASE_WORKER_URL pnpm dev",
    url: `${baseURL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: databaseURL,
      DATABASE_MIGRATION_URL: migrationDatabaseURL,
      DATABASE_INGRESS_URL: ingressDatabaseURL,
      BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET ?? "test".repeat(8),
      BETTER_AUTH_URL: baseURL,
      APP_BASE_URL: baseURL,
      AUTH_BOOTSTRAP_ENABLED: "true",
      MFA_ENFORCEMENT_ENABLED: process.env.E2E_MFA_ENFORCEMENT ?? "false",
      E2E_OTP_PRINT: "true",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      SMTP_FROM: "CRM Local <no-reply@crm.local>",
      MAILPIT_URL: process.env.MAILPIT_URL ?? "http://127.0.0.1:8025",
    },
  },
});
