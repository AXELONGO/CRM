import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { isPublicMutationRequestValid } from "@/infrastructure/http/public-mutation";
import { exchangePublicQuoteLink } from "@/modules/quotes/infrastructure/repositories";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: Request) {
  try {
    if (!isPublicMutationRequestValid(request))
      return NextResponse.json(
        { error: "El enlace no es válido o expiró." },
        { status: 403 },
      );
    const { token } = schema.parse(await request.json());
    const result = await getIngressDatabase().transaction((tx) =>
      exchangePublicQuoteLink(tx, token),
    );
    const jar = await cookies();
    jar.set("quote_public_session", result.session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    });
    jar.set("quote_public_csrf", result.csrf, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "El enlace no es válido o expiró." },
      { status: 404 },
    );
  }
}
