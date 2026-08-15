CREATE TYPE "public"."account_contact_type" AS ENUM('decision_maker', 'billing', 'technical', 'employee', 'other');--> statement-breakpoint
CREATE TYPE "public"."commercial_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."communication_channel" AS ENUM('email', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."communication_event_source" AS ENUM('manual', 'form', 'import', 'provider');--> statement-breakpoint
CREATE TYPE "public"."communication_event_status" AS ENUM('granted', 'denied', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."communication_purpose" AS ENUM('service', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."contact_method_label" AS ENUM('work', 'personal', 'other');--> statement-breakpoint
CREATE TYPE "public"."contact_method_type" AS ENUM('email', 'phone', 'whatsapp');--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE TABLE "crm_account_contacts" (
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"account_id" text NOT NULL,
	"title" text,
	"department" text,
	"relationship_type" "account_contact_type" DEFAULT 'other' NOT NULL,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "crm_account_contacts_tenant_id_contact_id_account_id_pk" PRIMARY KEY("tenant_id","contact_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "crm_account_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"author_membership_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"archived_at" timestamp,
	"edited_by_user_id" text,
	"archived_by_user_id" text,
	CONSTRAINT "crm_account_notes_body_length_check" CHECK (char_length("crm_account_notes"."body") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "crm_account_tags" (
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "crm_account_tags_tenant_id_account_id_tag_id_pk" PRIMARY KEY("tenant_id","account_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "crm_accounts" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_normalized" text NOT NULL,
	"legal_name" text,
	"website" text,
	"industry" text,
	"owner_membership_id" text,
	"status" "commercial_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"archived_by_user_id" text,
	CONSTRAINT "crm_accounts_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "crm_accounts_display_name_length_check" CHECK (char_length("crm_accounts"."display_name") between 2 and 160),
	CONSTRAINT "crm_accounts_website_length_check" CHECK ("crm_accounts"."website" is null or char_length("crm_accounts"."website") <= 2048)
);
--> statement-breakpoint
CREATE TABLE "crm_commercial_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"changed_fields" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_normalized" text NOT NULL,
	"given_name" text,
	"family_name" text,
	"owner_membership_id" text,
	"status" "commercial_status" DEFAULT 'active' NOT NULL,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"do_not_contact_reason" text,
	"do_not_contact_at" timestamp,
	"do_not_contact_by_user_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"archived_by_user_id" text,
	CONSTRAINT "crm_contacts_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "crm_contacts_display_name_length_check" CHECK (char_length("crm_contacts"."display_name") between 2 and 160),
	CONSTRAINT "crm_contacts_do_not_contact_reason_check" CHECK ("crm_contacts"."do_not_contact_reason" is null or char_length("crm_contacts"."do_not_contact_reason") <= 500),
	CONSTRAINT "crm_contacts_do_not_contact_consistency_check" CHECK ("crm_contacts"."do_not_contact" or "crm_contacts"."do_not_contact_reason" is null)
);
--> statement-breakpoint
CREATE TABLE "crm_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"color" text,
	"status" "commercial_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "crm_tags_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "crm_tags_name_length_check" CHECK (char_length("crm_tags"."name") between 1 and 80),
	CONSTRAINT "crm_tags_color_check" CHECK ("crm_tags"."color" is null or "crm_tags"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "crm_communication_consent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"purpose" "communication_purpose" NOT NULL,
	"status" "communication_event_status" NOT NULL,
	"source" "communication_event_source" NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"recorded_by_user_id" text,
	"evidence_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_consent_evidence_length_check" CHECK ("crm_communication_consent_events"."evidence_reference" is null or char_length("crm_communication_consent_events"."evidence_reference") <= 500)
);
--> statement-breakpoint
CREATE TABLE "crm_contact_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"type" "contact_method_type" NOT NULL,
	"label" "contact_method_label" DEFAULT 'other' NOT NULL,
	"original_value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "commercial_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contact_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"author_membership_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"archived_at" timestamp,
	"edited_by_user_id" text,
	"archived_by_user_id" text,
	CONSTRAINT "crm_contact_notes_body_length_check" CHECK (char_length("crm_contact_notes"."body") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "crm_contact_tags" (
	"tenant_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "crm_contact_tags_tenant_id_contact_id_tag_id_pk" PRIMARY KEY("tenant_id","contact_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "crm_account_contacts" ADD CONSTRAINT "crm_account_contacts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_contacts" ADD CONSTRAINT "crm_account_contacts_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_contacts" ADD CONSTRAINT "crm_account_contacts_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_notes" ADD CONSTRAINT "crm_account_notes_edited_by_user_id_user_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_notes" ADD CONSTRAINT "crm_account_notes_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_notes" ADD CONSTRAINT "crm_account_notes_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_notes" ADD CONSTRAINT "crm_account_notes_author_same_tenant_fk" FOREIGN KEY ("tenant_id","author_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_tags" ADD CONSTRAINT "crm_account_tags_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_tags" ADD CONSTRAINT "crm_account_tags_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_account_tags" ADD CONSTRAINT "crm_account_tags_tag_same_tenant_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."crm_tags"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_commercial_audit_events" ADD CONSTRAINT "crm_commercial_audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_commercial_audit_events" ADD CONSTRAINT "crm_commercial_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_do_not_contact_by_user_id_user_id_fk" FOREIGN KEY ("do_not_contact_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communication_consent_events" ADD CONSTRAINT "crm_communication_consent_events_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communication_consent_events" ADD CONSTRAINT "crm_consent_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_methods" ADD CONSTRAINT "crm_contact_methods_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_methods" ADD CONSTRAINT "crm_contact_methods_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_methods" ADD CONSTRAINT "crm_contact_methods_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "crm_contact_notes_edited_by_user_id_user_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "crm_contact_notes_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "crm_contact_notes_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_notes" ADD CONSTRAINT "crm_contact_notes_author_same_tenant_fk" FOREIGN KEY ("tenant_id","author_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_tags" ADD CONSTRAINT "crm_contact_tags_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_tags" ADD CONSTRAINT "crm_contact_tags_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_tags" ADD CONSTRAINT "crm_contact_tags_tag_same_tenant_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."crm_tags"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_account_contacts_primary_unique" ON "crm_account_contacts" USING btree ("tenant_id","account_id") WHERE "crm_account_contacts"."is_primary_contact";--> statement-breakpoint
CREATE INDEX "crm_account_contacts_contact_idx" ON "crm_account_contacts" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX "crm_account_contacts_account_idx" ON "crm_account_contacts" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_account_notes_tenant_id_unique" ON "crm_account_notes" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "crm_account_notes_entity_idx" ON "crm_account_notes" USING btree ("tenant_id","account_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_accounts_tenant_status_updated_idx" ON "crm_accounts" USING btree ("tenant_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "crm_accounts_tenant_owner_idx" ON "crm_accounts" USING btree ("tenant_id","owner_membership_id");--> statement-breakpoint
CREATE INDEX "crm_accounts_tenant_name_idx" ON "crm_accounts" USING btree ("tenant_id","display_name_normalized");--> statement-breakpoint
CREATE INDEX "crm_audit_tenant_created_idx" ON "crm_commercial_audit_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_audit_entity_idx" ON "crm_commercial_audit_events" USING btree ("tenant_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_contacts_tenant_status_updated_idx" ON "crm_contacts" USING btree ("tenant_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "crm_contacts_tenant_owner_idx" ON "crm_contacts" USING btree ("tenant_id","owner_membership_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_tenant_name_idx" ON "crm_contacts" USING btree ("tenant_id","display_name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_tags_tenant_name_unique" ON "crm_tags" USING btree ("tenant_id","name_normalized");--> statement-breakpoint
CREATE INDEX "crm_tags_tenant_status_idx" ON "crm_tags" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "crm_consent_contact_channel_purpose_idx" ON "crm_communication_consent_events" USING btree ("tenant_id","contact_id","channel","purpose","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contact_methods_value_unique" ON "crm_contact_methods" USING btree ("tenant_id","contact_id","type","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contact_methods_primary_unique" ON "crm_contact_methods" USING btree ("tenant_id","contact_id","type") WHERE "crm_contact_methods"."is_primary" and "crm_contact_methods"."status" = 'active';--> statement-breakpoint
CREATE INDEX "crm_contact_methods_search_idx" ON "crm_contact_methods" USING btree ("tenant_id","type","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contact_notes_tenant_id_unique" ON "crm_contact_notes" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "crm_contact_notes_entity_idx" ON "crm_contact_notes" USING btree ("tenant_id","contact_id","created_at");--> statement-breakpoint
--> statement-breakpoint
REVOKE ALL ON TABLE "crm_account_contacts", "crm_account_notes", "crm_account_tags", "crm_accounts", "crm_commercial_audit_events", "crm_contacts", "crm_tags", "crm_communication_consent_events", "crm_contact_methods", "crm_contact_notes", "crm_contact_tags" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "crm_account_contacts", "crm_account_notes", "crm_account_tags", "crm_accounts", "crm_commercial_audit_events", "crm_contacts", "crm_tags", "crm_communication_consent_events", "crm_contact_methods", "crm_contact_notes", "crm_contact_tags" TO crm_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user", "account", "session", "verification", "platform_administrators", "security_audit_events", "tenant_invitation_roles", "tenant_invitations", "tenant_membership_roles", "tenant_memberships", "tenants" TO crm_runtime;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'crm_account_contacts', 'crm_account_notes', 'crm_account_tags',
    'crm_accounts', 'crm_commercial_audit_events', 'crm_contacts',
    'crm_tags', 'crm_communication_consent_events', 'crm_contact_methods',
    'crm_contact_notes', 'crm_contact_tags'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END
$$;
