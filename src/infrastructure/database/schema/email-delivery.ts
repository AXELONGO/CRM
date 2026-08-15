import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const publicOtpDeliveryKindEnum = pgEnum("public_otp_delivery_kind", [
  "quote-otp",
  "agreement-otp",
]);
export const publicOtpDeliveryStatusEnum = pgEnum("public_otp_delivery_status", [
  "pending",
  "processing",
  "sent",
  "retry",
  "dead",
  "cancelled",
]);

export const publicOtpDeliveryJobs = pgTable(
  "public_otp_delivery_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    kind: publicOtpDeliveryKindEnum("kind").notNull(),
    subjectId: text("subject_id").notNull(),
    recipient: text("recipient").notNull(),
    recipientName: text("recipient_name").notNull(),
    codeCiphertext: text("code_ciphertext").notNull(),
    codeNonce: text("code_nonce").notNull(),
    codeAuthenticationTag: text("code_authentication_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: publicOtpDeliveryStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    availableAt: instant("available_at").defaultNow().notNull(),
    lockOwner: text("lock_owner"),
    leaseExpiresAt: instant("lease_expires_at"),
    deliveredAt: instant("delivered_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_otp_delivery_idempotency_unique").on(table.idempotencyKey),
    index("public_otp_delivery_claim_idx").on(
      table.tenantId,
      table.status,
      table.availableAt,
    ),
    check("public_otp_delivery_attempts_check", sql`${table.attempts} >= 0`),
    check(
      "public_otp_delivery_max_attempts_check",
      sql`${table.maxAttempts} between 1 and 8`,
    ),
  ],
);
