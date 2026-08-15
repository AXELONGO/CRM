import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { getPipelineBoard } from "@/modules/sales/infrastructure/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; pipelineId: string }> },
) {
  try {
    const { tenantSlug, pipelineId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "pipelines.view",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getPipelineBoard(tx, { tenantId: context.tenant.id, pipelineId }),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el pipeline." },
      { status: salesAuthorizationError(error) },
    );
  }
}
