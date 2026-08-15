import { NextResponse } from "next/server";
import { acceptWebhook } from "@/infrastructure/webhook-ingress/handler";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicFormKey: string }> },
) {
  try {
    const { publicFormKey } = await params;
    await acceptWebhook(publicFormKey, request, "web_form");
    return NextResponse.json({ accepted: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo recibir el formulario." },
      { status: 400 },
    );
  }
}
