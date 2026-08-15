import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  createPipeline,
  listPipelines,
} from "@/modules/sales/infrastructure/repositories";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().default(false),
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
      "pipelines.view",
    );
    return NextResponse.json({
      pipelines: await withTenantDatabase(getDatabase(), context, (tx) =>
        listPipelines(tx, context.tenant.id),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar los pipelines." },
      { status: salesAuthorizationError(error) },
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
      "pipelines.manage",
    );
    const body = schema.parse(await request.json());
    const pipeline = await withTenantDatabase(getDatabase(), context, (tx) =>
      createPipeline(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        ...body,
      }),
    );
    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el pipeline." },
      { status: salesAuthorizationError(error) },
    );
  }
}
