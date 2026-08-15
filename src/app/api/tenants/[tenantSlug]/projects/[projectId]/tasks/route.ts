import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  setProjectTaskBlockedReason,
  toggleProjectTaskChecklist,
  updateProjectTaskStatus,
} from "@/modules/projects/infrastructure/repositories";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move_status"),
    taskId: z.string().min(1),
    status: z.enum([
      "todo",
      "in_progress",
      "review",
      "blocked",
      "done",
      "cancelled",
    ]),
  }),
  z.object({
    action: z.literal("set_blocked_reason"),
    taskId: z.string().min(1),
    reason: z.string().max(1000),
  }),
  z.object({
    action: z.literal("toggle_checklist"),
    itemId: z.string().min(1),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; projectId: string }> },
) {
  try {
    const { tenantSlug, projectId } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "projects.manage_team",
    );
    const body = actionSchema.parse(await request.json());
    type Result =
      | { kind: "task"; task: { id: string; status: string } }
      | { kind: "checklist"; item: { id: string; completed: boolean } };
    const result: Result = await withTenantDatabase(getDatabase(), context, (tx) => {
      if (body.action === "move_status")
        return updateProjectTaskStatus(tx, {
          tenantId: context.tenant.id,
          projectId,
          taskId: body.taskId,
          status: body.status,
          membershipId: context.membership.id,
        }).then(({ task }) => ({
          kind: "task" as const,
          task: {
            id: task.id,
            status: task.status,
            position: task.position.toString(),
          },
        }));
      if (body.action === "set_blocked_reason")
        return setProjectTaskBlockedReason(tx, {
          tenantId: context.tenant.id,
          projectId,
          taskId: body.taskId,
          reason: body.reason,
        }).then(({ task }) => ({
          kind: "task" as const,
          task: {
            id: task.id,
            status: task.status,
            position: task.position.toString(),
          },
        }));
      return toggleProjectTaskChecklist(tx, {
        tenantId: context.tenant.id,
        projectId,
        itemId: body.itemId,
      }).then(({ item }) => ({ kind: "checklist" as const, item }));
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la tarea del proyecto." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
