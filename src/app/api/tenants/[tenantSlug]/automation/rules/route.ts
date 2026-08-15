import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  authorizationError,
} from "@/modules/commercial-directory/application/authorization";
import {
  createAutomationRule,
  listAutomationRules,
} from "@/modules/automation/infrastructure/repositories";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional(),
  module: z.enum(["sales", "inbox", "tenancy", "sla"]),
  triggerName: z.string().regex(/^[a-z][a-z0-9_.]{1,100}$/),
  definition: z.unknown(),
  summary: z.string().trim().min(1).max(500),
  definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
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
      "automations.view",
    );
    return NextResponse.json({
      rules: await withTenantDatabase(getDatabase(), context, (tx) =>
        listAutomationRules(tx, context.tenant.id),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las automatizaciones." },
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
      "automations.manage",
    );
    const body = createSchema.parse(await request.json());
    const rule = await withTenantDatabase(getDatabase(), context, (tx) =>
      createAutomationRule(tx, {
        ...body,
        tenantId: context.tenant.id,
        id: crypto.randomUUID(),
        versionId: crypto.randomUUID(),
        userId: actor.userId,
      }),
    );
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la automatización." },
      { status: authorizationError(error) },
    );
  }
}
