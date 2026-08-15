import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { updateTenantStatus } from "@/modules/tenancy/infrastructure/repositories";
import { requirePlatformActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission } from "@/modules/tenancy/domain/policy";

const statusSchema = z.object({ status: z.enum(["active", "suspended"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const actor = await requirePlatformActor(request);
    const { tenantId } = await params;
    const body = statusSchema.parse(await request.json());
    requirePermission(
      actor,
      body.status === "suspended"
        ? "platform.tenants.suspend"
        : "platform.tenants.reactivate",
    );
    const updated = await updateTenantStatus(getDatabase(), {
      tenantId,
      status: body.status,
      actorUserId: actor.userId,
    });
    if (!updated)
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ tenant: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la agencia." },
      { status: 400 },
    );
  }
}
