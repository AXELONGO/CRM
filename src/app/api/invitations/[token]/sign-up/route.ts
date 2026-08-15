import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, assertAuthRuntimeConfig } from "@/infrastructure/auth/auth";
import { getEnvironment } from "@/infrastructure/config/env";
import { getDatabase } from "@/infrastructure/database/client";
import { hasPendingInvitationToken } from "@/modules/tenancy/infrastructure/repositories";
import { normalizeInvitationEmail } from "@/modules/tenancy/domain/policy";

const signupSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  assertAuthRuntimeConfig();
  const { token } = await params;
  const body = signupSchema.parse(await request.json());
  const email = normalizeInvitationEmail(body.email);
  if (
    !process.env.DATABASE_URL ||
    !(await hasPendingInvitationToken(getDatabase(), token, email))
  ) {
    return NextResponse.json(
      { message: "No se pudo procesar la invitacion." },
      { status: 400 },
    );
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        name: body.name,
        password: body.password,
        callbackURL: `${getEnvironment().APP_BASE_URL}/invite/${encodeURIComponent(token)}`,
      },
      headers: new Headers({ "x-crm-invitation-token": token }),
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo procesar la invitacion." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message:
      "Si la invitacion puede procesarse, revisa tu correo y completa la verificacion.",
  });
}
