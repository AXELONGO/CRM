import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { isPublicMutationRequestValid } from "@/infrastructure/http/public-mutation";
import { shouldExposeOtpCodeForTest } from "@/infrastructure/security/public-otp";
import {
  requestAgreementOtp,
  verifyAgreementOtp,
} from "@/modules/agreements/infrastructure/repositories";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request") }),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }),
]);

export async function POST(request: Request) {
  try {
    if (!isPublicMutationRequestValid(request))
      return NextResponse.json(
        { error: "No se pudo procesar la verificación." },
        { status: 403 },
      );
    const session = (await cookies()).get("agreement_public_session")?.value;
    if (!session) throw new Error("SESSION_REQUIRED");
    const body = schema.parse(await request.json());
    if (body.action === "verify") {
      const result = await getIngressDatabase().transaction((tx) =>
        verifyAgreementOtp(tx, session, body.code),
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: "Código incorrecto o expirado." },
          { status: 400 },
        );
      }
      const jar = await cookies();
      jar.set("agreement_public_csrf", result.csrf!, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 3600,
      });
      return NextResponse.json(
        { verified: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await getIngressDatabase().transaction((tx) =>
      requestAgreementOtp(tx, session),
    );
    return NextResponse.json(
      {
        sent: true,
        ...(shouldExposeOtpCodeForTest() ? { testCode: result } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar la verificación." },
      { status: 400 },
    );
  }
}
