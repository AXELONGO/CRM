ALTER TABLE "tenant_invitation_roles" DROP CONSTRAINT "tenant_invitation_roles_invitation_id_tenant_invitations_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_membership_roles" DROP CONSTRAINT "tenant_membership_roles_membership_id_tenant_memberships_id_fk";
--> statement-breakpoint
DROP INDEX "tenant_invitation_roles_unique";--> statement-breakpoint
DROP INDEX "tenant_membership_roles_unique";--> statement-breakpoint
ALTER TABLE "tenant_invitation_roles" ADD CONSTRAINT "tenant_invitation_roles_invitation_id_role_pk" PRIMARY KEY("invitation_id","role");--> statement-breakpoint
ALTER TABLE "tenant_membership_roles" ADD CONSTRAINT "tenant_membership_roles_membership_id_role_pk" PRIMARY KEY("membership_id","role");--> statement-breakpoint
ALTER TABLE "tenant_invitation_roles" ADD CONSTRAINT "tenant_invitation_roles_invitation_id_tenant_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."tenant_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_membership_roles" ADD CONSTRAINT "tenant_membership_roles_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE restrict ON UPDATE no action;