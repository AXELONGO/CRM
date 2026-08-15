import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { getSessionFromRequest } from "@/modules/tenancy/infrastructure/server-context";
import { acceptInvitation } from "@/modules/tenancy/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.user.emailVerified) {
    return NextResponse.json(
      { error: "Necesitas iniciar sesion con un correo verificado." },
      { status: 401 },
    );
  }
  const { token } = await params;
  const accepted = await acceptInvitation(getDatabase(), {
    token,
    userId: session.user.id,
    userEmail: session.user.email,
  });
  if (!accepted) {
    return NextResponse.json({ error: "La invitacion no es valida." }, { status: 400 });
  }
  return NextResponse.json({ tenantSlug: accepted.tenantSlug, roles: accepted.roles });
}
