import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { updateActivityStatus } from "@/modules/sales/infrastructure/repositories";

const schema = z.object({
  version: z.number().int().positive(),
  status: z.enum(["completed", "cancelled"]),
  result: z.string().max(2000).nullable().optional(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; activityId: string }> },
) {
  try {
    const { tenantSlug, activityId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "sales_activities.manage",
    );
    const body = schema.parse(await request.json());
    const activity = await withTenantDatabase(getDatabase(), context, (tx) =>
      updateActivityStatus(tx, {
        tenantId: context.tenant.id,
        activityId,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ activity });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la actividad." },
      { status: salesAuthorizationError(error) },
    );
  }
}
