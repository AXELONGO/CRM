import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { getPublicPaymentRequest } from "@/modules/payments/infrastructure/repositories";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const payment = await getIngressDatabase().transaction((tx) =>
      getPublicPaymentRequest(tx, token),
    );
    return NextResponse.json(payment, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "La liga de pago no es válida o expiró." },
      { status: 404 },
    );
  }
}
