import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnvironment } from "@/infrastructure/config/env";
import { getDatabase } from "@/infrastructure/database/client";
import { sendInvitationEmail } from "@/infrastructure/email/smtp-email-sender";
import {
  createTenantWithInvitation,
  listTenants,
} from "@/modules/tenancy/infrastructure/repositories";
import { requirePlatformActor } from "@/modules/tenancy/infrastructure/server-context";
import { requirePermission } from "@/modules/tenancy/domain/policy";

const createTenantSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(63),
  timezone: z.string().trim().min(1).max(64).default("America/Tijuana"),
  locale: z.string().trim().min(2).max(16).default("es-MX"),
  adminEmail: z.string().email().max(320),
});

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "No se pudo completar la operacion.";
  if (message === "PLATFORM_FORBIDDEN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (message.includes("unique") || message.includes("duplicate")) {
    return NextResponse.json(
      { error: "El slug o la invitacion ya existe." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: "No se pudo completar la operacion." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor(request);
    requirePermission(actor, "platform.tenants.view");
    return NextResponse.json({ tenants: await listTenants(getDatabase()) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor(request);
    requirePermission(actor, "platform.tenants.create");
    const body = createTenantSchema.parse(await request.json());
    const environment = getEnvironment();
    const result = await createTenantWithInvitation(getDatabase(), {
      ...body,
      platformUserId: actor.userId,
      invitationTtlHours: environment.TENANT_INVITATION_TTL_HOURS,
    });
    sendInvitationEmail({
      recipient: body.adminEmail,
      recipientName: body.adminEmail,
      url: `${environment.APP_BASE_URL}/invite/${result.rawInvitationToken}`,
      appBaseUrl: environment.APP_BASE_URL,
    });
    return NextResponse.json(
      {
        tenant: result.tenant,
        message:
          "Agencia creada. Si el correo puede recibir una invitacion, se enviaron instrucciones.",
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
