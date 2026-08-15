import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { paymentConnections } from "@/infrastructure/database/schema";
import { fakePayPalServer } from "@/modules/payments/infrastructure/providers/paypal";
import { processFakePaymentWebhook } from "@/modules/payments/infrastructure/repositories";
import { verifyPayPalWebhook } from "@/modules/payments/domain/paypal";
const schema = z.object({
  eventId: z.string().min(8),
  orderId: z.string().min(8),
  requestId: z.string().min(1),
  merchantId: z.string().min(8),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const raw = await request.text();
  const connectionId = (await params).connectionId;
  if (
    raw.length > 1_000_000 ||
    !verifyPayPalWebhook(
      raw,
      request.headers.get("x-paypal-signature"),
      `fake-paypal-webhook:${connectionId}`,
    )
  )
    return NextResponse.json({ error: "Webhook inválido." }, { status: 401 });
  try {
    const body = schema.parse(JSON.parse(raw));
    const result = await getIngressDatabase().transaction(async (tx) => {
      const [connection] = await tx
        .select()
        .from(paymentConnections)
        .where(eq(paymentConnections.id, connectionId))
        .limit(1);
      if (!connection || connection.provider !== "paypal")
        throw new Error("PAYPAL_CONNECTION_NOT_FOUND");
      const order = fakePayPalServer.getOrder(body.orderId);
      if (order.merchantId !== body.merchantId || order.status !== "COMPLETED")
        throw new Error("PAYPAL_CAPTURE_NOT_AUTHORITATIVE");
      return processFakePaymentWebhook(tx, {
        tenantId: connection.tenantId,
        connectionId,
        eventId: body.eventId,
        requestId: body.requestId,
        amountMinor: order.amountMinor,
        currency: order.currency,
        provider: "paypal",
      });
    });
    return NextResponse.json({ accepted: true, repeated: result.repeated });
  } catch {
    return NextResponse.json({ error: "Webhook no procesable." }, { status: 409 });
  }
}
