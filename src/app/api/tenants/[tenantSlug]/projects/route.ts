import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { listProjects } from "@/modules/projects/infrastructure/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "projects.read",
    );
    return NextResponse.json({
      projects: await withTenantDatabase(getDatabase(), context, (tx) =>
        listProjects(tx, context.tenant.id),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar los proyectos." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
