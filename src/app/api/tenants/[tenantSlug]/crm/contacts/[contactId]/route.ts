import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import {
  getContact,
  setContactStatus,
  updateContact,
} from "@/modules/commercial-directory/infrastructure/repositories";
import { requirePermission } from "@/modules/tenancy/domain/policy";

const updateSchema = z.object({
  version: z.number().int().positive(),
  displayName: z.string().trim().min(2).max(160).optional(),
  givenName: z.string().max(160).nullable().optional(),
  familyName: z.string().max(160).nullable().optional(),
  ownerMembershipId: z.string().nullable().optional(),
  doNotContact: z.boolean().optional(),
  doNotContactReason: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; contactId: string }> },
) {
  try {
    const { tenantSlug, contactId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "contacts.view",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getContact(tx, context.tenant.id, contactId),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el contacto." },
      { status: authorizationError(error) },
    );
  }
}

export async function PATCH(
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
    const body = updateSchema.parse(await request.json());
    if (body.status) {
      requirePermission(
        actor,
        body.status === "archived" ? "contacts.archive" : "contacts.restore",
        context,
      );
    }
    const result = await withTenantDatabase(getDatabase(), context, async (tx) =>
      body.status
        ? setContactStatus(tx, {
            tenantId: context.tenant.id,
            contactId,
            actorUserId: actor.userId,
            version: body.version,
            status: body.status,
          })
        : updateContact(tx, {
            tenantId: context.tenant.id,
            contactId,
            actorUserId: actor.userId,
            ...body,
          }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar el contacto." },
      { status: authorizationError(error) },
    );
  }
}
