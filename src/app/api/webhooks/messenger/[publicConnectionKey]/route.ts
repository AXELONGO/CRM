import { NextResponse } from "next/server";
import { acceptWebhook } from "@/infrastructure/webhook-ingress/handler";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicConnectionKey: string }> },
) {
  try {
    const { publicConnectionKey } = await params;
    await acceptWebhook(publicConnectionKey, request, "messenger");
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook rechazado." }, { status: 401 });
  }
}
