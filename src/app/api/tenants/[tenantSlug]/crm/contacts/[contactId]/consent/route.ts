import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { recordConsent } from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({
  channel: z.enum(["email", "phone", "whatsapp"]),
  purpose: z.enum(["service", "marketing"]),
  status: z.enum(["granted", "denied", "revoked"]),
  source: z.enum(["manual", "form", "import", "provider"]),
  occurredAt: z.coerce.date(),
  evidenceReference: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; contactId: string }> },
) {
  try {
    const { tenantSlug, contactId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "contacts.communication_preferences.manage",
    );
    const body = schema.parse(await request.json());
    const event = await withTenantDatabase(getDatabase(), context, (tx) =>
      recordConsent(tx, {
        tenantId: context.tenant.id,
        contactId,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar la preferencia." },
      { status: authorizationError(error) },
    );
  }
}
