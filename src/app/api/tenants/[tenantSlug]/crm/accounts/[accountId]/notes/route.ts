import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { addNote } from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; accountId: string }> },
) {
  try {
    const { tenantSlug, accountId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "accounts.notes.create",
    );
    const body = schema.parse(await request.json());
    const id = await withTenantDatabase(getDatabase(), context, (tx) =>
      addNote(tx, {
        tenantId: context.tenant.id,
        entity: "account",
        entityId: accountId,
        authorMembershipId: context.membership.id,
        actorUserId: actor.userId,
        body: body.body,
      }),
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la nota." },
      { status: authorizationError(error) },
    );
  }
}
