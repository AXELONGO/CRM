import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import {
  resolveTenantContext,
  updateInvitationStatus,
} from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission } from "@/modules/tenancy/domain/policy";

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
    const updated = await updateInvitationStatus(getDatabase(), {
      tenantId: context.tenant.id,
      invitationId,
      status: "revoked",
      actorUserId: actor.userId,
    });
    if (!updated)
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ status: "revoked" });
  } catch {
    return NextResponse.json(
      { error: "No se pudo revocar la invitacion." },
      { status: 400 },
    );
  }
}
