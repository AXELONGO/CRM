import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { getOpportunity } from "@/modules/sales/infrastructure/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; opportunityId: string }> },
) {
  try {
    const { tenantSlug, opportunityId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "opportunities.view",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getOpportunity(tx, context.tenant.id, opportunityId),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar la oportunidad." },
      { status: salesAuthorizationError(error) },
    );
  }
}

const moveSchema = z.object({
  version: z.number().int().positive(),
  stageId: z.string(),
  beforeId: z.string().nullable().optional(),
  afterId: z.string().nullable().optional(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; opportunityId: string }> },
) {
  try {
    const { tenantSlug, opportunityId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "opportunities.move",
    );
    const body = moveSchema.parse(await request.json());
    const { moveOpportunity } =
      await import("@/modules/sales/infrastructure/repositories");
    const opportunity = await withTenantDatabase(getDatabase(), context, (tx) =>
      moveOpportunity(tx, {
        tenantId: context.tenant.id,
        opportunityId,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ opportunity });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo mover la oportunidad." },
      { status: salesAuthorizationError(error) },
    );
  }
}
