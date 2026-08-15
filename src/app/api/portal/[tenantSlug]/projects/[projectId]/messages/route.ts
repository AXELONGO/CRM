import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { sendPortalMessage } from "@/modules/portal/infrastructure/repositories";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; projectId: string }> },
) {
  try {
    const { tenantSlug, projectId } = await params;
    const { session, context } = await requireServerTenant(tenantSlug, "portal");
    const body = schema.parse(await request.json());
    const message = await withTenantDatabase(getDatabase(), context, (tx) =>
      sendPortalMessage(tx, {
        tenantId: context.tenant.id,
        userId: session.user.id,
        projectId,
        body: body.body,
      }),
    );
    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje." },
      { status: 400 },
    );
  }
}
