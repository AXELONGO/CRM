import { NextResponse } from "next/server";
import { getEnvironment } from "@/infrastructure/config/env";
import { getDatabase } from "@/infrastructure/database/client";
import { sendInvitationEmail } from "@/infrastructure/email/smtp-email-sender";
import { requirePermission } from "@/modules/tenancy/domain/policy";
import {
  resendInvitation,
  resolveTenantContext,
} from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; invitationId: string }> },
) {
  try {
    const { tenantSlug, invitationId } = await params;
    const actor = await getRequestActor(request);
    if (!actor)
      return NextResponse.json({ error: "Necesitas iniciar sesion." }, { status: 401 });
    const context = await resolveTenantContext(
      getDatabase(),
      actor.userId,
      tenantSlug,
      "internal",
    );
    if (!context)
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    requirePermission(actor, "members.invite", context);
    const environment = getEnvironment();
    const result = await resendInvitation(getDatabase(), {
      tenantId: context.tenant.id,
      invitationId,
      invitationTtlHours: environment.TENANT_INVITATION_TTL_HOURS,
      actorUserId: actor.userId,
    });
    if (!result) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    sendInvitationEmail({
      recipient: result.recipient,
      recipientName: result.recipient,
      url: `${environment.APP_BASE_URL}/invite/${result.rawInvitationToken}`,
      appBaseUrl: environment.APP_BASE_URL,
    });
    return NextResponse.json({
      message: "Si la invitacion sigue pendiente, se reenvio.",
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo reenviar la invitacion." },
      { status: 400 },
    );
  }
}
