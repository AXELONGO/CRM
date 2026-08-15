import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { auth } from "@/infrastructure/auth/auth";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { acceptAgreementInternally } from "@/modules/agreements/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; agreementId: string }> },
) {
  try {
    const { tenantSlug, agreementId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "agreements.sign_internal",
    );
    const session = await auth.api.getSession({ headers: await headers() });
    const createdAt = session?.session.createdAt
      ? new Date(session.session.createdAt).getTime()
      : 0;
    if (!session || Date.now() - createdAt > 15 * 60 * 1000)
      throw new Error("RECENT_AUTH_REQUIRED");
    const body = (await request.json()) as {
      fullName?: string;
      idempotencyKey?: string;
    };
    if (!body.fullName?.trim() || !body.idempotencyKey)
      throw new Error("ACCEPTANCE_FIELDS_REQUIRED");
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      acceptAgreementInternally(tx, {
        tenantId: context.tenant.id,
        agreementId,
        membershipId: context.membership.id,
        userId: actor.userId,
        fullName: body.fullName!,
        idempotencyKey: body.idempotencyKey!,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar la aceptación interna." },
      { status: salesAuthorizationError(error) },
    );
  }
}
