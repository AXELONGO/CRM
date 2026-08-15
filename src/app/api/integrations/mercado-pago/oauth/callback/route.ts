import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { getRequestActor } from "@/modules/tenancy/infrastructure/server-context";
import {
  consumeMercadoPagoAuthorization,
  storeMercadoPagoTokens,
} from "@/modules/payments/infrastructure/mercado-pago-repositories";
import { fakeMercadoPagoServer } from "@/modules/payments/infrastructure/providers/mercado-pago";

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
      const attempt = await consumeMercadoPagoAuthorization(tx, {
        state: input.state,
        userId: actor.userId,
      });
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${attempt.tenantId}, true)`,
      );
      const tokens = fakeMercadoPagoServer.exchangeAuthorizationCode(input.code!);
      const seller = fakeMercadoPagoServer.getUser(tokens.accessToken);
      if (seller.userId !== tokens.userId)
        throw new Error("MERCADO_PAGO_SELLER_MISMATCH");
      await storeMercadoPagoTokens(tx, {
        tenantId: attempt.tenantId,
        connectionId: attempt.connectionId,
        userId: actor.userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        sellerUserId: seller.userId,
        nickname: seller.nickname,
        email: seller.email,
        countryCode: seller.countryCode,
        siteId: seller.siteId,
        scopes: tokens.scopes,
      });
    });
    return new Response("Mercado Pago conectado en simulación local.", { status: 200 });
  } catch {
    return new Response("No se pudo completar la autorización", { status: 400 });
  }
}
