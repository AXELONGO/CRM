import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { forecast } from "@/modules/sales/infrastructure/repositories";

const querySchema = z.object({
  pipelineId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
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
      "sales_forecast.view",
    );
    const url = new URL(request.url);
    const query = querySchema.parse({
      pipelineId: url.searchParams.get("pipelineId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({
      forecast: await withTenantDatabase(getDatabase(), context, (tx) =>
        forecast(tx, { tenantId: context.tenant.id, ...query }),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo calcular el pronóstico." },
      { status: salesAuthorizationError(error) },
    );
  }
}
