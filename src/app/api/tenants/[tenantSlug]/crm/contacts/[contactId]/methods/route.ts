import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { addContactMethod } from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({
  type: z.enum(["email", "phone", "whatsapp"]),
  value: z.string().trim().min(3).max(320),
  countryCode: z.string().optional(),
  label: z.enum(["work", "personal", "other"]).default("other"),
  isPrimary: z.boolean().default(false),
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
      "contacts.update",
    );
    const body = schema.parse(await request.json());
    const method = await withTenantDatabase(getDatabase(), context, (tx) =>
      addContactMethod(tx, {
        tenantId: context.tenant.id,
        contactId,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el método de contacto." },
      { status: authorizationError(error) },
    );
  }
}
