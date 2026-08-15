-- Bind every new agreement action to its exact resource and authenticated actor.
ALTER TABLE "agreement_acceptance_actions" ADD COLUMN "request_hash" text;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD COLUMN "public_session_id" text;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD COLUMN "actor_user_id" text;
--> statement-breakpoint
UPDATE "agreement_acceptance_actions"
SET "request_hash" = encode(public.digest('legacy:' || "id", 'sha256'), 'hex')
WHERE "request_hash" IS NULL;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ALTER COLUMN "request_hash" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_identity_unique"
  ON "agreement_versions" ("tenant_id", "id", "agreement_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_envelopes_identity_unique"
  ON "agreement_envelopes" ("tenant_id", "id", "agreement_id", "version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_recipients_envelope_identity_unique"
  ON "agreement_recipients" ("tenant_id", "id", "envelope_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_public_sessions_recipient_identity_unique"
  ON "agreement_public_sessions" ("tenant_id", "id", "recipient_id");
--> statement-breakpoint
ALTER TABLE "agreement_envelopes"
  ADD CONSTRAINT "agreement_envelopes_version_agreement_identity_fk"
  FOREIGN KEY ("tenant_id", "version_id", "agreement_id")
  REFERENCES "public"."agreement_versions" ("tenant_id", "id", "agreement_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions"
  ADD CONSTRAINT "agreement_actions_envelope_identity_fk"
  FOREIGN KEY ("tenant_id", "envelope_id", "agreement_id", "version_id")
  REFERENCES "public"."agreement_envelopes" ("tenant_id", "id", "agreement_id", "version_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions"
  ADD CONSTRAINT "agreement_actions_recipient_envelope_fk"
  FOREIGN KEY ("tenant_id", "recipient_id", "envelope_id")
  REFERENCES "public"."agreement_recipients" ("tenant_id", "id", "envelope_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions"
  ADD CONSTRAINT "agreement_actions_public_session_recipient_fk"
  FOREIGN KEY ("tenant_id", "public_session_id", "recipient_id")
  REFERENCES "public"."agreement_public_sessions" ("tenant_id", "id", "recipient_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions"
  ADD CONSTRAINT "agreement_actions_actor_user_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."user" ("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions"
  ADD CONSTRAINT "agreement_actions_actor_binding_check"
  CHECK (
    ("actor_kind" = 'external_contact' AND "public_session_id" IS NOT NULL AND "actor_user_id" IS NULL)
    OR
    ("actor_kind" = 'internal_member' AND "public_session_id" IS NULL AND "actor_user_id" IS NOT NULL)
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles"
  ADD CONSTRAINT "agreement_evidence_envelope_identity_fk"
  FOREIGN KEY ("tenant_id", "envelope_id", "agreement_id", "version_id")
  REFERENCES "public"."agreement_envelopes" ("tenant_id", "id", "agreement_id", "version_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records"
  ADD CONSTRAINT "agreement_external_version_agreement_identity_fk"
  FOREIGN KEY ("tenant_id", "version_id", "agreement_id")
  REFERENCES "public"."agreement_versions" ("tenant_id", "id", "agreement_id")
  ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID;
