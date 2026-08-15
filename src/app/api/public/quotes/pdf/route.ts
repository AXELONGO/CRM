import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { LocalObjectStorage } from "@/infrastructure/object-storage/local";
import { getQuotePdfDownload } from "@/modules/quotes/infrastructure/repositories";

export async function GET() {
  try {
    const session = (await cookies()).get("quote_public_session")?.value;
    if (!session) throw new Error("SESSION_REQUIRED");
    const file = await getIngressDatabase().transaction((tx) =>
      getQuotePdfDownload(tx, session),
    );
    const bytes = await new LocalObjectStorage().read({
      tenantId: file.tenantId,
      key: file.key,
    });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cotizacion.pdf"',
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF no disponible." }, { status: 404 });
  }
}
