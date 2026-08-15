import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  createAgreementTemplate,
  listAgreementTemplates,
} from "@/modules/agreements/infrastructure/repositories";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  documentType: z.enum([
    "fixed_project_service_agreement",
    "hourly_consulting_agreement",
    "retainer_service_agreement",
    "signable_proposal",
    "statement_of_work",
  ]),
  pricingModel: z.string().min(1).max(40),
  sections: z.array(z.record(z.string(), z.unknown())).max(60),
  variables: z.array(z.string().regex(/^[a-z]+\.[a-z_]+$/)).max(30),
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
      "agreements.read",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        listAgreementTemplates(tx, context.tenant.id),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las plantillas." },
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
      "agreement_templates.manage",
    );
    const body = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      createAgreementTemplate(tx, {
        ...body,
        tenantId: context.tenant.id,
        userId: actor.userId,
      }),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la plantilla." },
      { status: salesAuthorizationError(error) },
    );
  }
}
