import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { wahaSessionBindings } from "@/infrastructure/database/schema";
import { and, eq } from "drizzle-orm";
import { FakeWahaServer } from "@/modules/integrations/infrastructure/fake-waha";
import { updateWahaSessionState } from "@/modules/integrations/infrastructure/waha-repositories";
import { selectWahaConnection } from "@/modules/integrations/infrastructure/waha-repositories";

const inputSchema = z.object({
  action: z.enum(["start", "stop", "restart", "logout", "confirm_identity", "select"]),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; connectionId: string }> },
) {
  try {
    const { tenantSlug, connectionId } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.manage",
    );
    const { action } = inputSchema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const [binding] = await tx
        .select()
        .from(wahaSessionBindings)
        .where(
          and(
            eq(wahaSessionBindings.tenantId, context.tenant.id),
            eq(wahaSessionBindings.connectionId, connectionId),
          ),
        )
        .limit(1);
      if (!binding) throw new Error("WAHA_SESSION_NOT_FOUND");
      if (action === "select") {
        await selectWahaConnection(tx, {
          tenantId: context.tenant.id,
          connectionId,
          userId: actor.userId,
        });
        return { binding, provider: { selected: true } };
      }
      const fake = new FakeWahaServer();
      const provider =
        action === "start"
          ? await fake.startSession()
          : action === "stop"
            ? await fake.stopSession()
            : action === "restart"
              ? await fake.restartSession()
              : action === "logout"
                ? await fake.logoutSession()
                : await fake.getMe();
      const state =
        action === "start" || action === "restart"
          ? "qr_required"
          : action === "stop"
            ? "stopped"
            : action === "logout"
              ? "logged_out"
              : "working";
      return updateWahaSessionState(tx, {
        tenantId: context.tenant.id,
        connectionId,
        state,
        expectedVersion: binding.version,
      }).then((updated) => ({ binding: updated, provider }));
    });
    return NextResponse.json({ ...result, mode: "test_only" });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo controlar la sesión WAHA." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
