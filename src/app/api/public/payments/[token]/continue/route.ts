import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { getPublicPaymentCheckoutUrl } from "@/modules/payments/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  try {
    const { token } = await params;
    const hostedUrl = await getIngressDatabase().transaction((tx) =>
      getPublicPaymentCheckoutUrl(tx, token),
    );
    return NextResponse.redirect(hostedUrl, 303);
  } catch {
    return NextResponse.json(
      { error: "La liga de pago no es válida o expiró." },
      { status: 404 },
    );
  }
}
