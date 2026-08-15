/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'crm_tags'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

ALTER TABLE "crm_tags" DROP CONSTRAINT "crm_tags_pkey";--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_tenant_id_id_pk" PRIMARY KEY("tenant_id","id");
--> statement-breakpoint
ALTER TABLE "crm_account_tags" DROP CONSTRAINT "crm_account_tags_tag_same_tenant_fk";
--> statement-breakpoint
ALTER TABLE "crm_contact_tags" DROP CONSTRAINT "crm_contact_tags_tag_same_tenant_fk";
--> statement-breakpoint
ALTER TABLE "crm_tags" DROP CONSTRAINT "crm_tags_tenant_id_unique";
--> statement-breakpoint
ALTER TABLE "crm_account_tags" ADD CONSTRAINT "crm_account_tags_tag_same_tenant_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."crm_tags"("tenant_id","id");
--> statement-breakpoint
ALTER TABLE "crm_contact_tags" ADD CONSTRAINT "crm_contact_tags_tag_same_tenant_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."crm_tags"("tenant_id","id");
