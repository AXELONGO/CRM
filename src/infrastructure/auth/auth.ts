import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { randomBytes } from "node:crypto";
import { getEnvironment } from "@/infrastructure/config/env";
import { getDatabase } from "@/infrastructure/database/client";
import * as authSchema from "@/infrastructure/database/schema/auth";
import { emailSender } from "@/infrastructure/email/smtp-email-sender";
import { buildAuthEmailUrl } from "@/infrastructure/email/url";
import { hasPendingInvitationToken } from "@/modules/tenancy/infrastructure/repositories";

const environment = getEnvironment();
const baseURL = environment.BETTER_AUTH_URL ?? environment.APP_BASE_URL;
const buildOnlySecret =
  process.env.NEXT_PHASE === "phase-production-build"
    ? randomBytes(32).toString("base64")
    : undefined;

function sendAuthEmail(
  kind: "verification" | "password-reset",
  user: { email: string; name?: string | null },
  url: string,
): void {
  void emailSender
    .send({
      kind,
      recipient: user.email,
      recipientName: user.name ?? "usuario",
      url: buildAuthEmailUrl(url, baseURL),
    })
    .catch(() => {
      console.error(`[auth] fallo al enviar correo de ${kind}`);
    });
}

export const auth = betterAuth({
  appName: "CRM",
  baseURL,
  trustedOrigins: [baseURL],
  secret: environment.BETTER_AUTH_SECRET ?? buildOnlySecret,
  database: environment.DATABASE_URL
    ? drizzleAdapter(getDatabase(), {
        provider: "pg",
        schema: authSchema,
      })
    : undefined,
  emailAndPassword: {
    enabled: true,
    // Public signup remains unavailable: the before hook below permits only
    // an explicit local bootstrap or a valid tenant invitation.
    disableSignUp: false,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendAuthEmail("password-reset", user, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      sendAuthEmail("verification", user, url);
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: environment.NODE_ENV === "production",
    disableCSRFCheck: false,
    disableOriginCheck: false,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: environment.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  },
  rateLimit: {
    enabled: true,
    storage: "memory",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: environment.NODE_ENV === "test" ? 30 : 5,
      },
      "/request-password-reset": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 5 },
      "/sign-up/email": {
        window: 60,
        max: environment.NODE_ENV === "test" ? 30 : 2,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") return;
      const invitationToken = context.headers?.get("x-crm-invitation-token");
      const bootstrapAllowed =
        environment.NODE_ENV !== "production" && environment.AUTH_BOOTSTRAP_ENABLED;
      const bootstrapHeader = context.headers?.get("x-crm-bootstrap") === "true";
      if (bootstrapAllowed && bootstrapHeader) return;

      const bodyEmail =
        typeof context.body?.email === "string" ? context.body.email : "";
      if (
        !invitationToken ||
        !environment.DATABASE_URL ||
        !(await hasPendingInvitationToken(getDatabase(), invitationToken, bodyEmail))
      ) {
        throw new APIError("FORBIDDEN", { message: "La invitacion no es valida." });
      }
    }),
    after: createAuthMiddleware(async (context) => {
      const events: Record<string, string> = {
        "/sign-in/email": "login completado",
        "/request-password-reset": "recuperacion solicitada",
        "/send-verification-email": "verificacion solicitada",
        "/sign-out": "logout completado",
      };
      const event = events[context.path];
      if (event) {
        console.info(`[auth] ${event}`);
      }
    }),
  },
  telemetry: { enabled: false },
  plugins: [
    twoFactor({
      issuer: "CRM",
      skipVerificationOnEnable: false,
      trustDevice: false,
      backupCodeOptions: { storeBackupCodes: "encrypted" },
    }),
  ],
});

export function assertAuthRuntimeConfig(): void {
  const current = getEnvironment();

  if (!current.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET es obligatoria para utilizar autenticacion.");
  }

  if (current.NODE_ENV !== "production") {
    return;
  }

  if (current.AUTH_BOOTSTRAP_ENABLED) {
    throw new Error("AUTH_BOOTSTRAP_ENABLED debe estar desactivado en produccion.");
  }
  if (current.PLATFORM_ADMIN_BOOTSTRAP_ENABLED) {
    throw new Error(
      "PLATFORM_ADMIN_BOOTSTRAP_ENABLED debe estar desactivado en produccion.",
    );
  }

  const authURL = current.BETTER_AUTH_URL ?? current.APP_BASE_URL;
  if (!authURL.startsWith("https://")) {
    throw new Error("BETTER_AUTH_URL o APP_BASE_URL debe usar HTTPS en produccion.");
  }

  if (!current.DATABASE_URL) {
    throw new Error("DATABASE_URL es obligatoria para autenticacion en produccion.");
  }
}
