import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import {
  consumeStripeAuthorization,
  saveStripeAccount,
} from "@/modules/payments/infrastructure/stripe-repositories";
import { fakeStripeServer } from "@/modules/payments/infrastructure/providers/stripe";
const schema = z.object({
  state: z.string().min(20),
  code: z.string().min(8).optional(),
  error: z.string().optional(),
});
export async function GET(request: Request) {
  const actor = await getRequestActor(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  try {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (input.error || !input.code)
      return new Response("Autorización cancelada", { status: 400 });
    await getDatabase().transaction(async (tx) => {
      const attempt = await consumeStripeAuthorization(tx, {
        state: input.state,
        userId: actor.userId,
      });
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${attempt.tenantId}, true)`,
      );
      const result = fakeStripeServer.exchangeCode(input.code!);
      if (result.livemode) throw new Error("STRIPE_LIVE_DISABLED");
      await saveStripeAccount(tx, {
        tenantId: attempt.tenantId,
        connectionId: attempt.connectionId,
        stripeUserId: result.stripeUserId,
        scope: result.scope,
      });
    });
    return new Response("Stripe conectado en simulación local.", { status: 200 });
  } catch {
    return new Response("No se pudo completar la conexión Stripe", { status: 400 });
  }
}
