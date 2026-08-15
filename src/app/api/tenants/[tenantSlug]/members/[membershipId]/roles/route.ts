import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import {
  replaceMembershipRoles,
  resolveTenantContext,
} from "@/modules/tenancy/infrastructure/repositories";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission, tenantRoles } from "@/modules/tenancy/domain/policy";

const schema = z.object({ roles: z.array(z.enum(tenantRoles)).min(1) });

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
    requirePermission(actor, "members.roles.manage", context);
    const body = schema.parse(await request.json());
    const result = await replaceMembershipRoles(getDatabase(), {
      tenantId: context.tenant.id,
      membershipId,
      roles: body.roles,
      actorUserId: actor.userId,
    });
    if (!result) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    if (result.blockedLastAdmin) {
      return NextResponse.json(
        { error: "La agencia debe conservar un administrador activo." },
        { status: 409 },
      );
    }
    return NextResponse.json({ roles: body.roles });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron actualizar los roles." },
      { status: 400 },
    );
  }
}
