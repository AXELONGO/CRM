import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  createOpportunity,
  getPipelineBoard,
} from "@/modules/sales/infrastructure/repositories";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  pipelineId: z.string(),
  stageId: z.string().optional(),
  primaryContactId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  ownerMembershipId: z.string(),
  sourceId: z.string().nullable().optional(),
  pricingModel: z.enum(["fixed_price", "hourly", "retainer", "other"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  estimatedValueMinor: z.number().int().nonnegative().safe(),
  hourlyRateMinor: z.number().int().nonnegative().safe().nullable().optional(),
  estimatedHours: z.number().int().positive().safe().nullable().optional(),
  retainerMonthlyMinor: z.number().int().nonnegative().safe().nullable().optional(),
  retainerDurationMonths: z.number().int().positive().safe().nullable().optional(),
  pricingExplanation: z.string().max(1000).nullable().optional(),
  probabilityOverride: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: z.coerce.date().nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "opportunities.view",
    );
    const pipelineId = new URL(request.url).searchParams.get("pipelineId");
    if (!pipelineId)
      return NextResponse.json({ error: "pipelineId es requerido." }, { status: 400 });
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getPipelineBoard(tx, { tenantId: context.tenant.id, pipelineId }),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las oportunidades." },
      { status: salesAuthorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "opportunities.create",
    );
    const body = schema.parse(await request.json());
    const opportunity = await withTenantDatabase(getDatabase(), context, (tx) =>
      createOpportunity(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la oportunidad." },
      { status: salesAuthorizationError(error) },
    );
  }
}
