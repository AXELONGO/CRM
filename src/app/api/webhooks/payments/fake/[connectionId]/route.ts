import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getIngressDatabase } from "@/infrastructure/database/client";
import {
  processFakePaymentWebhook,
  verifyFakeWebhookSignature,
} from "@/modules/payments/infrastructure/repositories";

const schema = z.object({
  eventId: z.string().min(8).max(120),
  requestId: z.string().min(1),
  amountMinor: z.string().regex(/^[1-9][0-9]*$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const raw = await request.text();
  if (
    raw.length > 64_000 ||
    !verifyFakeWebhookSignature(raw, request.headers.get("x-fake-signature"))
  )
    return NextResponse.json({ error: "Webhook inválido." }, { status: 400 });
  try {
    const { connectionId } = await params;
    const body = schema.parse(JSON.parse(raw));
    const result = await getIngressDatabase().transaction(async (tx) => {
      const [connection] = await tx.query.paymentConnections.findMany({
        where: (table, operators) => operators.eq(table.id, connectionId),
        limit: 1,
      });
      if (!connection || connection.provider !== "fake")
        throw new Error("PAYMENT_CONNECTION_NOT_FOUND");
      return processFakePaymentWebhook(tx, {
        tenantId: connection.tenantId,
        connectionId,
        eventId: body.eventId,
        requestId: body.requestId,
        amountMinor: BigInt(body.amountMinor),
        currency: body.currency,
      });
    });
    return NextResponse.json({ accepted: true, repeated: result.repeated });
  } catch {
    return NextResponse.json({ error: "Webhook no procesable." }, { status: 409 });
  }
}
