REVOKE ALL ON TABLE "twoFactor" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "twoFactor" TO crm_runtime;
