import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const integrationConnectionStatusEnum = pgEnum("integration_connection_status", [
  "draft",
  "configuring",
  "pending_verification",
  "verified",
  "active",
  "degraded",
  "disabled",
  "revoked",
  "failed",
]);
export const messagingSelectionStateEnum = pgEnum("messaging_selection_state", [
  "none",
  "pending_cutover",
  "active",
  "paused",
]);
export const integrationProviderEventStatusEnum = pgEnum(
  "integration_provider_event_status",
  ["received", "processing", "processed", "ignored", "retry", "dead"],
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    providerCode: text("provider_code").notNull(),
    displayName: text("display_name").notNull(),
    ownershipMode: text("ownership_mode").notNull(),
    status: integrationConnectionStatusEnum("status").default("draft").notNull(),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    externalRefs: jsonb("external_refs")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    config: jsonb("config").$type<Record<string, string>>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    lastVerifiedAt: instant("last_verified_at"),
    activatedAt: instant("activated_at"),
    revokedAt: instant("revoked_at"),
    createdByUserId: text("created_by_user_id").notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("integration_connections_provider_status_idx").on(
      table.tenantId,
      table.providerCode,
      table.status,
    ),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "integration_connection_tenant_fk",
    }),
  ],
);
export const tenantMessagingProviderSelections = pgTable(
  "tenant_messaging_provider_selections",
  {
    tenantId: text("tenant_id").notNull(),
    capability: text("capability").notNull(),
    activeConnectionId: text("active_connection_id"),
    state: messagingSelectionStateEnum("state").default("none").notNull(),
    previousConnectionId: text("previous_connection_id"),
    version: integer("version").default(1).notNull(),
    activatedAt: instant("activated_at"),
    activatedByUserId: text("activated_by_user_id"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.capability] }),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "messaging_selection_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.activeConnectionId],
      foreignColumns: [integrationConnections.tenantId, integrationConnections.id],
      name: "messaging_selection_connection_same_tenant_fk",
    }),
  ],
);
export const metaWhatsAppConfigs = pgTable(
  "meta_whatsapp_configs",
  {
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    graphApiVersion: text("graph_api_version").notNull(),
    appId: text("app_id").notNull(),
    wabaId: text("waba_id").notNull(),
    phoneNumberId: text("phone_number_id").notNull(),
    displayPhoneSnapshot: text("display_phone_snapshot"),
    verifiedNameSnapshot: text("verified_name_snapshot"),
    publicConnectionKeyHash: text("public_connection_key_hash").notNull(),
    configVersion: integer("config_version").default(1).notNull(),
    webhookVerifiedAt: instant("webhook_verified_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.connectionId] }),
    uniqueIndex("meta_whatsapp_phone_active_unique").on(table.phoneNumberId),
    uniqueIndex("meta_whatsapp_public_key_unique").on(table.publicConnectionKeyHash),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [integrationConnections.tenantId, integrationConnections.id],
      name: "meta_whatsapp_connection_same_tenant_fk",
    }),
  ],
);
export const metaWhatsAppTemplates = pgTable(
  "meta_whatsapp_templates",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    externalTemplateId: text("external_template_id").notNull(),
    name: text("name").notNull(),
    language: text("language").notNull(),
    status: text("status").notNull(),
    componentsSummary: jsonb("components_summary")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    contentHash: text("content_hash").notNull(),
    syncedAt: instant("synced_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("meta_template_external_unique").on(
      table.tenantId,
      table.connectionId,
      table.externalTemplateId,
      table.language,
    ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [integrationConnections.tenantId, integrationConnections.id],
      name: "meta_template_connection_same_tenant_fk",
    }),
  ],
);
export const integrationProviderEvents = pgTable(
  "integration_provider_events",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    dedupKey: text("dedup_key").notNull(),
    eventType: text("event_type").notNull(),
    bodyHash: text("body_hash").notNull(),
    status: integrationProviderEventStatusEnum("status").default("received").notNull(),
    receivedAt: instant("received_at").defaultNow().notNull(),
    processedAt: instant("processed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("integration_provider_event_dedup_unique").on(
      table.tenantId,
      table.connectionId,
      table.dedupKey,
    ),
    index("integration_provider_event_status_idx").on(
      table.tenantId,
      table.status,
      table.receivedAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [integrationConnections.tenantId, integrationConnections.id],
      name: "integration_event_connection_same_tenant_fk",
    }),
  ],
);

export const wahaInstanceStatusEnum = pgEnum("waha_instance_status", [
  "draft",
  "healthy",
  "degraded",
  "disabled",
]);
export const wahaSessionStateEnum = pgEnum("waha_session_state", [
  "unprovisioned",
  "stopped",
  "starting",
  "qr_required",
  "pairing_required",
  "passkey_required",
  "authenticated",
  "working",
  "degraded",
  "failed",
  "stopping",
  "logged_out",
  "revoked",
  "unknown",
]);
export const wahaInstances = pgTable(
  "waha_instances",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    baseUrl: text("base_url").notNull(),
    environment: text("environment").notNull(),
    status: wahaInstanceStatusEnum("status").default("draft").notNull(),
    imageVersion: text("image_version").notNull(),
    imageDigest: text("image_digest"),
    engine: text("engine").notNull(),
    namespace: text("namespace").notNull(),
    adminSecretRef: text("admin_secret_ref").notNull(),
    networkMode: text("network_mode").notNull(),
    sessionStorageType: text("session_storage_type").notNull(),
    mediaStorageType: text("media_storage_type").notNull(),
    capacityLimit: integer("capacity_limit").default(10).notNull(),
    currentSessions: integer("current_sessions").default(0).notNull(),
    healthSnapshot: jsonb("health_snapshot")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    lastCheckedAt: instant("last_checked_at"),
    version: integer("version").default(1).notNull(),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("waha_instances_environment_status_idx").on(table.environment, table.status),
  ],
);
export const wahaSessionBindings = pgTable(
  "waha_session_bindings",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    instanceId: text("instance_id").notNull(),
    sessionName: text("session_name").notNull(),
    engine: text("engine").notNull(),
    state: wahaSessionStateEnum("state").default("unprovisioned").notNull(),
    providerAccountIdSnapshot: text("provider_account_id_snapshot"),
    maskedPhoneSnapshot: text("masked_phone_snapshot"),
    pushNameSnapshot: text("push_name_snapshot"),
    sessionKeyRef: text("session_key_ref"),
    mediaKeyRef: text("media_key_ref"),
    webhookHmacSecretRef: text("webhook_hmac_secret_ref"),
    publicConnectionKeyHash: text("public_connection_key_hash").notNull(),
    riskAcceptedAt: instant("risk_accepted_at"),
    startedAt: instant("started_at"),
    authenticatedAt: instant("authenticated_at"),
    workingAt: instant("working_at"),
    stoppedAt: instant("stopped_at"),
    failedAt: instant("failed_at"),
    loggedOutAt: instant("logged_out_at"),
    lastEventAt: instant("last_event_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("waha_binding_connection_unique").on(
      table.tenantId,
      table.connectionId,
    ),
    uniqueIndex("waha_binding_instance_session_unique").on(
      table.instanceId,
      table.sessionName,
    ),
    uniqueIndex("waha_binding_public_key_unique").on(table.publicConnectionKeyHash),
    index("waha_binding_tenant_state_idx").on(table.tenantId, table.state),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "waha_binding_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [integrationConnections.tenantId, integrationConnections.id],
      name: "waha_binding_connection_fk",
    }),
    foreignKey({
      columns: [table.instanceId],
      foreignColumns: [wahaInstances.id],
      name: "waha_binding_instance_fk",
    }),
  ],
);
