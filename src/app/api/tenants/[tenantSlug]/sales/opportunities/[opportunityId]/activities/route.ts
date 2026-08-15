import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { createActivity } from "@/modules/sales/infrastructure/repositories";

const schema = z.object({
  type: z.enum(["call", "meeting", "email", "whatsapp", "task", "note"]),
  status: z.enum(["planned", "completed", "cancelled"]).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  ownerMembershipId: z.string(),
  contactId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  result: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; opportunityId: string }> },
) {
  try {
    const { tenantSlug, opportunityId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "sales_activities.create",
    );
    const body = schema.parse(await request.json());
    const activity = await withTenantDatabase(getDatabase(), context, (tx) =>
      createActivity(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        opportunityId,
        ...body,
      }),
    );
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la actividad." },
      { status: salesAuthorizationError(error) },
    );
  }
}
