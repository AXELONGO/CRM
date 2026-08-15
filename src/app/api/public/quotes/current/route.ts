import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { toPublicQuoteDto } from "@/modules/quotes/application/public-quote-dto";
import { getPublicQuoteSession } from "@/modules/quotes/infrastructure/repositories";

export async function GET() {
  try {
    const session = (await cookies()).get("quote_public_session")?.value;
    if (!session) throw new Error("SESSION_REQUIRED");
    const quote = await getIngressDatabase().transaction((tx) =>
      getPublicQuoteSession(tx, session),
    );
    return NextResponse.json(toPublicQuoteDto(quote), {
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
