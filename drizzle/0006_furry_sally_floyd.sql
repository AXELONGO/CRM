ALTER TABLE "sales_opportunities" DROP CONSTRAINT "sales_opportunities_stage_same_tenant_fk";
--> statement-breakpoint
ALTER TABLE "sales_stage_history" DROP CONSTRAINT "sales_stage_history_to_stage_same_tenant_fk";
--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_stage_same_pipeline_fk" FOREIGN KEY ("tenant_id","pipeline_id","stage_id") REFERENCES "public"."sales_pipeline_stages"("tenant_id","pipeline_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_stage_history" ADD CONSTRAINT "sales_stage_history_to_stage_same_pipeline_fk" FOREIGN KEY ("tenant_id","pipeline_id","to_stage_id") REFERENCES "public"."sales_pipeline_stages"("tenant_id","pipeline_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
