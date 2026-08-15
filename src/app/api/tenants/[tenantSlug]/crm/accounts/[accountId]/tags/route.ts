import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { assignTag } from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({ tagId: z.string() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; accountId: string }> },
) {
  try {
    const { tenantSlug, accountId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "tags.manage",
    );
    const body = schema.parse(await request.json());
    await withTenantDatabase(getDatabase(), context, (tx) =>
      assignTag(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        entity: "account",
        entityId: accountId,
        tagId: body.tagId,
      }),
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo asignar la etiqueta." },
      { status: authorizationError(error) },
    );
  }
}
