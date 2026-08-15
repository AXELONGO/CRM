import { NextResponse } from "next/server";
import {
  acceptWebhook,
  verifyMetaChallenge,
} from "@/infrastructure/webhook-ingress/handler";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicConnectionKey: string }> },
) {
  try {
    const { publicConnectionKey } = await params;
    const url = new URL(request.url);
    return new Response(
      await verifyMetaChallenge(
        publicConnectionKey,
        url.searchParams.get("hub.mode"),
        url.searchParams.get("hub.verify_token"),
        url.searchParams.get("hub.challenge"),
      ),
      { status: 200, headers: { "content-type": "text/plain" } },
    );
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicConnectionKey: string }> },
) {
  try {
    const { publicConnectionKey } = await params;
    await acceptWebhook(publicConnectionKey, request, "whatsapp_meta");
    return NextResponse.json({ received: true });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "WEBHOOK_SIGNATURE_INVALID"
        ? 401
        : error instanceof Error && error.message === "WEBHOOK_BODY_TOO_LARGE"
          ? 413
          : 400;
    return NextResponse.json({ error: "Webhook rechazado." }, { status });
  }
}
