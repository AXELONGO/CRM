import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("CRM"),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  DATABASE_INGRESS_URL: z.string().url().optional(),
  DATABASE_WORKER_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_BOOTSTRAP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PLATFORM_ADMIN_BOOTSTRAP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MFA_ENFORCEMENT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  TENANT_INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(168),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_FROM: z
    .string()
    .min(1)
    .refine((value) => /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value), {
      message: "debe incluir una direccion de correo valida",
    })
    .default("CRM Local <no-reply@crm.local>"),
  STORAGE_DRIVER: z.enum(["filesystem", "s3"]).default("filesystem"),
  FILE_STORAGE_PATH: z.string().min(1).default("./.local-storage"),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
  INTEGRATION_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
  PUBLIC_FORM_SIGNING_KEY: z.string().optional(),
  INTEGRATION_WORKER_POLL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  INTEGRATION_JOB_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  INTEGRATION_JOB_LEASE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  AUTOMATION_WORKER_POLL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  AUTOMATION_JOB_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  AUTOMATION_JOB_LEASE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  WEBHOOK_MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10_000_000)
    .default(1_048_576),
  INBOUND_RECEIPT_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  ALLOW_LOCAL_INTEGRATION_HOSTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  WAHA_LIVE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  WAHA_WEBHOOK_ORIGIN: z.string().url().default("http://localhost:3000"),
  WAHA_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(1).max(900).default(300),
  MERCADO_PAGO_ADAPTER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  MERCADO_PAGO_LIVE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MERCADO_PAGO_ENVIRONMENT: z.enum(["fake", "test", "live"]).default("fake"),
  MERCADO_PAGO_OAUTH_CLIENT_ID: z.string().min(1).default("fake-client-id"),
  MERCADO_PAGO_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/integrations/mercado-pago/oauth/callback"),
  PAYMENTS_RETURN_ORIGIN: z.string().url().default("http://localhost:3000"),
  STRIPE_ADAPTER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  STRIPE_LIVE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STRIPE_ENVIRONMENT: z.enum(["fake", "sandbox", "live"]).default("fake"),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1).default("ca_fake_crm"),
  STRIPE_CONNECT_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/integrations/stripe/oauth/callback"),
  PAYPAL_ADAPTER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  PAYPAL_LIVE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PAYPAL_ENVIRONMENT: z.enum(["fake", "sandbox", "live"]).default("fake"),
  PAYPAL_PLATFORM_APPROVAL_STATUS: z
    .enum([
      "not_requested",
      "requested",
      "sandbox_ready",
      "approved",
      "rejected",
      "unknown",
    ])
    .default("sandbox_ready"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function getEnvironment(
  source: Record<string, string | undefined> = process.env,
): Environment {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Configuracion invalida: ${issues}`);
  }

  return parsed.data;
}

export function requireDatabaseUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const databaseUrl = getEnvironment(source).DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL es obligatoria para utilizar la base de datos.");
  }

  return databaseUrl;
}

export function requireMigrationDatabaseUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const databaseUrl = getEnvironment(source).DATABASE_MIGRATION_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_MIGRATION_URL es obligatoria para ejecutar migraciones.");
  }

  return databaseUrl;
}
