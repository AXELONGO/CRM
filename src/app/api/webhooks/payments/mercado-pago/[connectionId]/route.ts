import { NextResponse } from "next/server";
import { z } from "zod";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { paymentConnections } from "@/infrastructure/database/schema";
import {
  fakeMercadoPagoServer,
  verifyMercadoPagoWebhook,
} from "@/modules/payments/infrastructure/providers/mercado-pago";
import { processFakePaymentWebhook } from "@/modules/payments/infrastructure/repositories";
import { eq } from "drizzle-orm";

const schema = z.object({
  eventId: z.string().min(8).max(120),
  requestId: z.string().min(1),
  amountMinor: z.string().regex(/^[1-9][0-9]*$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  providerPaymentId: z.string().min(8),
  sellerUserId: z.string().min(8),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const raw = await request.text();
  const connectionId = (await params).connectionId;
  const secret = `fake-mp-webhook:${connectionId}`;
  if (
    raw.length > 64_000 ||
    !verifyMercadoPagoWebhook(raw, request.headers.get("x-signature"), secret)
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
      if (!connection || connection.provider !== "mercadopago")
        throw new Error("PAYMENT_CONNECTION_NOT_FOUND");
      const providerPayment = fakeMercadoPagoServer.getPaymentForWebhook(
        body.providerPaymentId,
      );
      if (
        providerPayment.sellerUserId !== body.sellerUserId ||
        providerPayment.amountMinor !== BigInt(body.amountMinor) ||
        providerPayment.currency !== body.currency ||
        providerPayment.status !== "approved"
      )
        throw new Error("MERCADO_PAGO_PAYMENT_MISMATCH");
      return processFakePaymentWebhook(tx, {
        tenantId: connection.tenantId,
        connectionId,
        eventId: body.eventId,
        requestId: body.requestId,
        amountMinor: BigInt(body.amountMinor),
        currency: body.currency,
        provider: "mercadopago",
      });
    });
    return NextResponse.json({ accepted: true, repeated: result.repeated });
  } catch {
    return NextResponse.json({ error: "Webhook no procesable." }, { status: 409 });
  }
}
