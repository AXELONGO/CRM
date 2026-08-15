import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { isPublicMutationRequestValid } from "@/infrastructure/http/public-mutation";
import { constantTimeEqual } from "@/infrastructure/security/constant-time";
import { decidePublicQuote } from "@/modules/quotes/infrastructure/repositories";

const schema = z.object({
  decision: z.enum(["accepted", "rejected", "changes_requested"]),
  fullName: z.string().trim().min(2).max(200),
  consent: z.boolean(),
  csrfToken: z.string().min(20).max(200),
  comment: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().min(16).max(100),
});

export async function POST(request: Request) {
  try {
    if (!isPublicMutationRequestValid(request))
      return NextResponse.json(
        { error: "No se pudo registrar la decisión." },
        { status: 403 },
      );
    const jar = await cookies();
    const sessionToken = jar.get("quote_public_session")?.value;
    const csrfToken = jar.get("quote_public_csrf")?.value;
    if (!sessionToken || !csrfToken) throw new Error("SESSION_REQUIRED");
    const body = schema.parse(await request.json());
    if (!constantTimeEqual(body.csrfToken, csrfToken)) {
      throw new Error("QUOTE_CSRF_COOKIE_MISMATCH");
    }
    const result = await getIngressDatabase().transaction((tx) =>
      decidePublicQuote(tx, { ...body, sessionToken }),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar la decisión." },
      { status: 400 },
    );
  }
}
