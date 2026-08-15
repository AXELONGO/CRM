import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  getProject,
  requestActivation,
  selectTemplateForProject,
  activateProject,
  decideApproval,
} from "@/modules/projects/infrastructure/repositories";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select_template"), templateId: z.string().min(1) }),
  z.object({
    action: z.literal("request_activation"),
    idempotencyKey: z.string().min(16).max(120),
  }),
  z.object({ action: z.literal("activate") }),
  z.object({
    action: z.literal("decide_approval"),
    approvalId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(500).optional(),
  }),
]);

function serializeProjectDetail(detail: {
  project: Record<string, unknown>;
  phases: Array<Record<string, unknown>>;
  tasks: Array<{ position: bigint; [key: string]: unknown }>;
  checklistItems: Array<Record<string, unknown>>;
}) {
  return {
    ...detail,
    project: detail.project,
    phases: detail.phases,
    tasks: detail.tasks.map((task) => ({
      ...task,
      position: task.position.toString(),
    })),
    checklistItems: detail.checklistItems,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; projectId: string }> },
) {
  try {
    const { tenantSlug, projectId } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "projects.read",
    );
    return NextResponse.json(
      serializeProjectDetail(
        await withTenantDatabase(getDatabase(), context, (tx) =>
          getProject(tx, context.tenant.id, projectId),
        ),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el proyecto." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; projectId: string }> },
) {
  try {
    const { tenantSlug, projectId } = await params;
    const body = actionSchema.parse(await request.json());
    const permission =
      body.action === "select_template"
        ? "projects.manage_draft"
        : body.action === "request_activation"
          ? "projects.request_activation"
          : body.action === "decide_approval"
            ? "projects.approve_activation"
            : "projects.activate";
    const { context } = await getPaymentsAuthorization(request, tenantSlug, permission);
    const result =
      body.action === "select_template"
        ? await withTenantDatabase(getDatabase(), context, (tx) =>
            selectTemplateForProject(tx, {
              tenantId: context.tenant.id,
              projectId,
              templateId: body.templateId,
            }),
          )
        : body.action === "request_activation"
          ? await withTenantDatabase(getDatabase(), context, (tx) =>
              requestActivation(tx, {
                tenantId: context.tenant.id,
                projectId,
                membershipId: context.membership.id,
                idempotencyKey: body.idempotencyKey,
              }),
            )
          : body.action === "decide_approval"
            ? await withTenantDatabase(getDatabase(), context, (tx) =>
                decideApproval(tx, {
                  tenantId: context.tenant.id,
                  approvalId: body.approvalId,
                  reviewerMembershipId: context.membership.id,
                  decision: body.decision,
                  reason: body.reason,
                }),
              )
            : await withTenantDatabase(getDatabase(), context, (tx) =>
                activateProject(tx, {
                  tenantId: context.tenant.id,
                  projectId,
                  membershipId: context.membership.id,
                }),
              );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo ejecutar la acción del proyecto." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
