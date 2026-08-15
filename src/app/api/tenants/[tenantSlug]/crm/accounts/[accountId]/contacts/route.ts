import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { relateContactToAccount } from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({
  contactId: z.string(),
  title: z.string().max(160).optional(),
  department: z.string().max(160).optional(),
  relationshipType: z
    .enum(["decision_maker", "billing", "technical", "employee", "other"])
    .default("other"),
  isPrimaryContact: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; accountId: string }> },
) {
  try {
    const { tenantSlug, accountId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "accounts.update",
    );
    const body = schema.parse(await request.json());
    await withTenantDatabase(getDatabase(), context, (tx) =>
      relateContactToAccount(tx, {
        tenantId: context.tenant.id,
        accountId,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo relacionar el contacto." },
      { status: authorizationError(error) },
    );
  }
}
