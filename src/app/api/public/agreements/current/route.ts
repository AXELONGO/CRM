import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { getAgreementPublicView } from "@/modules/agreements/infrastructure/repositories";

export async function GET() {
  try {
    const token = (await cookies()).get("agreement_public_session")?.value;
    if (!token) throw new Error("SESSION_REQUIRED");
    const view = await getIngressDatabase().transaction((tx) =>
      getAgreementPublicView(tx, token),
    );
    return NextResponse.json(view, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }
}
