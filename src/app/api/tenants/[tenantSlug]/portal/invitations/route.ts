import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { createPortalInvitation } from "@/modules/portal/infrastructure/repositories";

const schema = z.object({
  accountId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  email: z.string().email(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "projects.manage_team",
    );
    const input = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      createPortalInvitation(tx, {
        tenantId: context.tenant.id,
        accountId: input.accountId,
        contactId: input.contactId,
        email: input.email,
        createdByUserId: actor.userId,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
      }),
    );
    return NextResponse.json(
      { invitationId: result.invitation.id, token: result.token },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la invitación del portal." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
