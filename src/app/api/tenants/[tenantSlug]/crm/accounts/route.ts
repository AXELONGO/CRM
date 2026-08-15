import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import {
  createAccount,
  listAccounts,
} from "@/modules/commercial-directory/infrastructure/repositories";

const schema = z.object({
  displayName: z.string().trim().min(2).max(160),
  legalName: z.string().max(160).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  ownerMembershipId: z.string().nullable().optional(),
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
      "accounts.view",
    );
    const url = new URL(request.url);
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      listAccounts(tx, {
        tenantId: context.tenant.id,
        query: url.searchParams.get("q") || undefined,
        status:
          (url.searchParams.get("status") as "active" | "archived" | null) ?? undefined,
        ownerMembershipId: url.searchParams.get("owner") || undefined,
        limit: Math.min(Number(url.searchParams.get("limit") || 25), 100),
        cursor: url.searchParams.get("cursor") || undefined,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las cuentas." },
      { status: authorizationError(error) },
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
      "accounts.create",
    );
    const body = schema.parse(await request.json());
    const account = await withTenantDatabase(getDatabase(), context, (tx) =>
      createAccount(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la cuenta comercial." },
      { status: authorizationError(error) },
    );
  }
}
