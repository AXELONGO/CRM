import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnvironment } from "@/infrastructure/config/env";
import { getDatabase } from "@/infrastructure/database/client";
import { sendInvitationEmail } from "@/infrastructure/email/smtp-email-sender";
import {
  createInvitation,
  listTenantInvitations,
  listTenantMembers,
  resolveTenantContext,
} from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission, tenantRoles } from "@/modules/tenancy/domain/policy";

const invitationSchema = z.object({
  email: z.string().email().max(320),
  roles: z.array(z.enum(tenantRoles)).min(1),
});

async function getAuthorizedContext(request: Request, tenantSlug: string) {
  const actor = await getRequestActor(request);
  if (!actor) throw new Error("UNAUTHENTICATED");
  const context = await resolveTenantContext(
    getDatabase(),
    actor.userId,
    tenantSlug,
    "internal",
  );
  if (!context) throw new Error("FORBIDDEN");
  requirePermission(actor, "members.view", context);
  return { actor, context };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getAuthorizedContext(request, tenantSlug);
    const db = getDatabase();
    return NextResponse.json({
      members: await listTenantMembers(db, context.tenant.id),
      invitations: await listTenantInvitations(db, context.tenant.id),
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: "No autorizado." }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getAuthorizedContext(request, tenantSlug);
    requirePermission(actor, "members.invite", context);
    const body = invitationSchema.parse(await request.json());
    const environment = getEnvironment();
    const result = await createInvitation(getDatabase(), {
      tenantId: context.tenant.id,
      invitedByUserId: actor.userId,
      email: body.email,
      roles: body.roles,
      invitationTtlHours: environment.TENANT_INVITATION_TTL_HOURS,
    });
    sendInvitationEmail({
      recipient: body.email,
      recipientName: body.email,
      url: `${environment.APP_BASE_URL}/invite/${result.rawInvitationToken}`,
      appBaseUrl: environment.APP_BASE_URL,
    });
    return NextResponse.json(
      { message: "Si la invitacion puede procesarse, se enviaron instrucciones." },
      { status: 201 },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 400;
    return NextResponse.json({ error: "No se pudo crear la invitacion." }, { status });
  }
}
