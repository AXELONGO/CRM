import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { paymentConnections } from "@/infrastructure/database/schema";
import { fakeStripeServer } from "@/modules/payments/infrastructure/providers/stripe";
import { processFakePaymentWebhook } from "@/modules/payments/infrastructure/repositories";
import { verifyStripeWebhook } from "@/modules/payments/domain/stripe";

const schema = z.object({
  id: z.string().min(8),
  type: z.enum([
    "checkout.session.completed",
    "payment_intent.succeeded",
    "account.application.deauthorized",
  ]),
  account: z.string().min(8),
  paymentIntentId: z.string().min(8).optional(),
  requestId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = "fake-stripe-connect-webhook";
  if (
    raw.length > 1_000_000 ||
    !verifyStripeWebhook(raw, request.headers.get("stripe-signature"), secret)
  )
    return NextResponse.json({ error: "Webhook inválido." }, { status: 401 });
  try {
    const body = schema.parse(JSON.parse(raw));
    const result = await getIngressDatabase().transaction(async (tx) => {
      const [connection] = await tx
        .select()
        .from(paymentConnections)
        .where(eq(paymentConnections.externalAccountId, body.account))
        .limit(1);
      if (!connection || connection.provider !== "stripe")
        throw new Error("STRIPE_CONNECTION_NOT_FOUND");
      if (body.type === "account.application.deauthorized") {
        await tx
          .update(paymentConnections)
          .set({
            status: "revoked",
            lastErrorCode: "STRIPE_DEAUTHORIZED",
            updatedAt: new Date(),
          })
          .where(eq(paymentConnections.id, connection.id));
        return { repeated: false, deauthorized: true };
      }
      if (!body.paymentIntentId || !body.requestId)
        throw new Error("STRIPE_EVENT_INCOMPLETE");
      const payment = fakeStripeServer.getPayment(body.paymentIntentId, body.account);
      if (payment.accountId !== body.account || payment.status !== "succeeded")
        throw new Error("STRIPE_PAYMENT_NOT_AUTHORITATIVE");
      return processFakePaymentWebhook(tx, {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        eventId: body.id,
        requestId: body.requestId,
        amountMinor: payment.amountMinor,
        currency: payment.currency.toUpperCase(),
        provider: "stripe",
      });
    });
    return NextResponse.json({ accepted: true, repeated: result.repeated });
  } catch {
    return NextResponse.json({ error: "Webhook no procesable." }, { status: 409 });
  }
}
