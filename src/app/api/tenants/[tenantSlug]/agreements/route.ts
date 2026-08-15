import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  createAgreement,
  listAgreements,
} from "@/modules/agreements/infrastructure/repositories";

const bodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  agreementType: z.enum([
    "fixed_project_service_agreement",
    "hourly_consulting_agreement",
    "retainer_service_agreement",
    "signable_proposal",
    "statement_of_work",
  ]),
  quoteId: z.string().min(1),
  provider: z.object({
    name: z.string().trim().min(2).max(200),
    email: z.string().email(),
    role: z.string().trim().min(1).max(120),
  }),
  customer: z.object({
    name: z.string().trim().min(2).max(200),
    email: z.string().email(),
    role: z.string().trim().min(1).max(120),
  }),
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
        listAgreements(tx, context.tenant.id),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar los acuerdos." },
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
      "agreements.create",
    );
    const body = bodySchema.parse(await request.json());
    const agreement = await withTenantDatabase(getDatabase(), context, (tx) =>
      createAgreement(tx, {
        ...body,
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        ownerMembershipId: context.membership.id,
      }),
    );
    return NextResponse.json({ agreement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el acuerdo." },
      { status: salesAuthorizationError(error) },
    );
  }
}
