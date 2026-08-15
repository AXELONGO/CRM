import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  createTemplate,
  listTemplates,
  publishTemplate,
} from "@/modules/projects/infrastructure/repositories";
import type { ProjectTemplateContent } from "@/modules/projects/domain/templates";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  activationPolicyId: z.string().min(1),
  commercialModels: z.array(z.string()).max(4).default([]),
});
const publishSchema = z.object({
  templateId: z.string().min(1),
  content: z.object({
    phases: z.array(
      z.object({ key: z.string(), name: z.string(), order: z.number().int() }),
    ),
    tasks: z.array(
      z.object({
        key: z.string(),
        phaseKey: z.string(),
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        reviewRequired: z.boolean().optional(),
        checklist: z.array(z.string()).optional(),
        dependencyKeys: z.array(z.string()).optional(),
      }),
    ),
  }),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "project_templates.read",
    );
    return NextResponse.json({
      templates: await withTenantDatabase(getDatabase(), context, (tx) =>
        listTemplates(tx, context.tenant.id),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las plantillas." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "project_templates.manage",
    );
    const body = await request.json();
    const result =
      "content" in body
        ? await withTenantDatabase(getDatabase(), context, (tx) =>
            publishTemplate(tx, {
              tenantId: context.tenant.id,
              templateId: publishSchema.parse(body).templateId,
              membershipId: context.membership.id,
              content: publishSchema.parse(body).content as ProjectTemplateContent,
            }),
          )
        : await withTenantDatabase(getDatabase(), context, (tx) =>
            createTemplate(tx, {
              ...createSchema.parse(body),
              tenantId: context.tenant.id,
              membershipId: context.membership.id,
            }),
          );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la plantilla." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
