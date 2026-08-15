import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import {
  changeMembershipStatus,
  resolveTenantContext,
} from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission } from "@/modules/tenancy/domain/policy";

const schema = z.object({ status: z.enum(["active", "suspended", "revoked"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; membershipId: string }> },
) {
  try {
    const { tenantSlug, membershipId } = await params;
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
    requirePermission(actor, "members.status.manage", context);
    const body = schema.parse(await request.json());
    const result = await changeMembershipStatus(getDatabase(), {
      tenantId: context.tenant.id,
      membershipId,
      status: body.status,
      actorUserId: actor.userId,
    });
    if (!result) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    if (result.blockedLastAdmin) {
      return NextResponse.json(
        { error: "La agencia debe conservar un administrador activo." },
        { status: 409 },
      );
    }
    return NextResponse.json({ status: body.status });
  } catch {
    return NextResponse.json(
      { error: "No se pudo actualizar la membresia." },
      { status: 400 },
    );
  }
}
