import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  closeOpportunity,
  reopenOpportunity,
} from "@/modules/sales/infrastructure/repositories";

const schema = z.object({
  version: z.number().int().positive(),
  state: z.enum(["won", "lost", "open"]),
  finalValueMinor: z.number().int().nonnegative().nullable().optional(),
  lostReasonId: z.string().nullable().optional(),
  lostExplanation: z.string().max(1000).nullable().optional(),
  cancelPlannedActivities: z.boolean().default(false),
  stageId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; opportunityId: string }> },
) {
  try {
    const { tenantSlug, opportunityId } = await params;
    const body = schema.parse(await request.json());
    const permission =
      body.state === "won"
        ? "opportunities.close_won"
        : body.state === "lost"
          ? "opportunities.close_lost"
          : "opportunities.reopen";
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      permission,
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) => {
      if (body.state === "open")
        return reopenOpportunity(tx, {
          tenantId: context.tenant.id,
          opportunityId,
          actorUserId: actor.userId,
          version: body.version,
          stageId: body.stageId ?? "",
        });
      return closeOpportunity(tx, {
        tenantId: context.tenant.id,
        opportunityId,
        actorUserId: actor.userId,
        version: body.version,
        state: body.state,
        finalValueMinor: body.finalValueMinor,
        lostReasonId: body.lostReasonId,
        lostExplanation: body.lostExplanation,
        cancelPlannedActivities: body.cancelPlannedActivities,
      });
    });
    return NextResponse.json({ opportunity: result });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cambiar el estado de la oportunidad." },
      { status: salesAuthorizationError(error) },
    );
  }
}
