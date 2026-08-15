CREATE TYPE "public"."portal_access_status" AS ENUM('invited', 'active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."portal_decision" AS ENUM('approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."portal_domain_status" AS ENUM('draft', 'pending_verification', 'verified', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."portal_invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."portal_message_status" AS ENUM('sent', 'read', 'archived');--> statement-breakpoint
CREATE TABLE "portal_access_project_scopes" (
	"tenant_id" text NOT NULL,
	"access_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_access_project_scopes_tenant_id_access_id_project_id_pk" PRIMARY KEY("tenant_id","access_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "portal_accesses" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"contact_id" text,
	"status" "portal_access_status" DEFAULT 'invited' NOT NULL,
	"locale" text DEFAULT 'es-MX' NOT NULL,
	"timezone" text DEFAULT 'America/Tijuana' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_accesses_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_brand_profiles" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"logo_object_key" text,
	"primary_color" text DEFAULT '#2457D6' NOT NULL,
	"accent_color" text DEFAULT '#18212F' NOT NULL,
	"support_label" text DEFAULT 'Soporte de la agencia' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_brand_profiles_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_deliverable_decisions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"deliverable_version_id" text NOT NULL,
	"access_id" text NOT NULL,
	"decision" "portal_decision" NOT NULL,
	"comment" text,
	"decision_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_deliverable_decisions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_deliverable_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"deliverable_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"object_key" text,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_deliverable_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_deliverables" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_deliverables_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_domains" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"hostname" text NOT NULL,
	"status" "portal_domain_status" DEFAULT 'draft' NOT NULL,
	"verification_token_hash" text,
	"verified_at" timestamp with time zone,
	"active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_domains_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_invitations" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"contact_id" text,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "portal_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_user_id" text NOT NULL,
	"accepted_user_id" text,
	"accepted_access_id" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_invitations_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_messages" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"status" "portal_message_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "portal_messages_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "portal_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_project_conversations" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_project_conversations_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "portal_access_project_scopes" ADD CONSTRAINT "portal_scope_access_same_tenant_fk" FOREIGN KEY ("tenant_id","access_id") REFERENCES "public"."portal_accesses"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_project_scopes" ADD CONSTRAINT "portal_scope_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_access_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_access_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_access_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_access_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_brand_profiles" ADD CONSTRAINT "portal_brand_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_deliverable_decisions" ADD CONSTRAINT "portal_decision_version_same_tenant_fk" FOREIGN KEY ("tenant_id","deliverable_version_id") REFERENCES "public"."portal_deliverable_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_deliverable_decisions" ADD CONSTRAINT "portal_decision_access_same_tenant_fk" FOREIGN KEY ("tenant_id","access_id") REFERENCES "public"."portal_accesses"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_deliverable_versions" ADD CONSTRAINT "portal_deliverable_version_same_tenant_fk" FOREIGN KEY ("tenant_id","deliverable_id") REFERENCES "public"."portal_deliverables"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_deliverables" ADD CONSTRAINT "portal_deliverable_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_domains" ADD CONSTRAINT "portal_domain_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitation_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_message_conversation_same_tenant_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."portal_project_conversations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_project_conversations" ADD CONSTRAINT "portal_conversation_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_user_account_unique" ON "portal_accesses" USING btree ("tenant_id","user_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_brand_tenant_unique" ON "portal_brand_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_deliverable_decision_unique" ON "portal_deliverable_decisions" USING btree ("tenant_id","deliverable_version_id","access_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_deliverable_version_unique" ON "portal_deliverable_versions" USING btree ("tenant_id","deliverable_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_domain_hostname_unique" ON "portal_domains" USING btree ("hostname");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_invitation_token_unique" ON "portal_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "portal_invitation_pending_idx" ON "portal_invitations" USING btree ("tenant_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "portal_outbox_tenant_created_idx" ON "portal_outbox_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_project_conversation_unique" ON "portal_project_conversations" USING btree ("tenant_id","project_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "portal_access_project_scopes", "portal_accesses", "portal_brand_profiles", "portal_deliverable_decisions", "portal_deliverable_versions", "portal_deliverables", "portal_domains", "portal_invitations", "portal_messages", "portal_outbox_events", "portal_project_conversations" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'portal_access_project_scopes', 'portal_accesses', 'portal_brand_profiles',
    'portal_deliverable_decisions', 'portal_deliverable_versions', 'portal_deliverables',
    'portal_domains', 'portal_invitations', 'portal_messages', 'portal_outbox_events',
    'portal_project_conversations'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
