import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import {
  getAccount,
  setAccountStatus,
  updateAccount,
} from "@/modules/commercial-directory/infrastructure/repositories";
import { requirePermission } from "@/modules/tenancy/domain/policy";

const schema = z.object({
  version: z.number().int().positive(),
  status: z.enum(["active", "archived"]).optional(),
  displayName: z.string().trim().min(2).max(160).optional(),
  legalName: z.string().max(160).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  ownerMembershipId: z.string().nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; accountId: string }> },
) {
  try {
    const { tenantSlug, accountId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "accounts.view",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getAccount(tx, context.tenant.id, accountId),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar la cuenta." },
      { status: authorizationError(error) },
    );
  }
}

export async function PATCH(
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
    if (body.status) {
      requirePermission(
        actor,
        body.status === "archived" ? "accounts.archive" : "accounts.restore",
        context,
      );
    }
    const account = await withTenantDatabase(getDatabase(), context, (tx) =>
      body.status
        ? setAccountStatus(tx, {
            tenantId: context.tenant.id,
            accountId,
            actorUserId: actor.userId,
            version: body.version,
            status: body.status,
          })
        : updateAccount(tx, {
            tenantId: context.tenant.id,
            accountId,
            actorUserId: actor.userId,
            ...body,
          }),
    );
    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la cuenta." },
      { status: authorizationError(error) },
    );
  }
}
