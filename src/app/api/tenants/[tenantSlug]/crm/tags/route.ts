import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  authorizationError,
  getCommercialAuthorization,
} from "@/modules/commercial-directory/application/authorization";
import { commercialTags } from "@/infrastructure/database/schema";
import { createTag } from "@/modules/commercial-directory/infrastructure/repositories";
import { and, asc, eq } from "drizzle-orm";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
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
      "tags.view",
    );
    const tags = await withTenantDatabase(getDatabase(), context, (tx) =>
      tx
        .select()
        .from(commercialTags)
        .where(
          and(
            eq(commercialTags.tenantId, context.tenant.id),
            eq(commercialTags.status, "active"),
          ),
        )
        .orderBy(asc(commercialTags.name)),
    );
    return NextResponse.json({ tags });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las etiquetas." },
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
      "tags.manage",
    );
    const body = schema.parse(await request.json());
    return NextResponse.json(
      {
        tag: await withTenantDatabase(getDatabase(), context, (tx) =>
          createTag(tx, {
            tenantId: context.tenant.id,
            actorUserId: actor.userId,
            ...body,
          }),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la etiqueta." },
      { status: authorizationError(error) },
    );
  }
}
