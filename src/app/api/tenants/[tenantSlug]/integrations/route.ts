import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { getIntegrationCatalog } from "@/modules/integrations/domain/catalog";
import {
  createMetaWhatsAppConnection,
  listIntegrationConnections,
} from "@/modules/integrations/infrastructure/repositories";
import { provisionFakeWahaSession } from "@/modules/integrations/infrastructure/waha-repositories";

const schema = z.object({
  displayName: z.string().min(2).max(120),
  appId: z.string().regex(/^[A-Za-z0-9_-]{6,120}$/),
  wabaId: z.string().regex(/^[0-9]{6,30}$/),
  phoneNumberId: z.string().regex(/^[0-9]{6,30}$/),
  graphApiVersion: z
    .string()
    .regex(/^v[0-9]+\.[0-9]+$/)
    .default("v21.0"),
});
const wahaSchema = z.object({
  displayName: z.string().min(2).max(120),
  riskAccepted: z.literal(true),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.catalog.read",
    );
    return NextResponse.json({
      catalog: getIntegrationCatalog(),
      connections: await withTenantDatabase(getDatabase(), context, (tx) =>
        listIntegrationConnections(tx, context.tenant.id),
      ),
      mode: "test_only",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el centro de integraciones." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.connection.create",
    );
    const raw = await request.json();
    if (raw.providerCode === "waha") {
      const input = wahaSchema.parse(raw);
      const result = await withTenantDatabase(getDatabase(), context, (tx) =>
        provisionFakeWahaSession(tx, {
          ...input,
          tenantId: context.tenant.id,
          userId: actor.userId,
        }),
      );
      return NextResponse.json({ ...result, mode: "test_only" }, { status: 201 });
    }
    const input = schema.parse(raw);
    const publicConnectionKey = `fake_${crypto.randomUUID().replaceAll("-", "")}`;
    const connection = await withTenantDatabase(getDatabase(), context, (tx) =>
      createMetaWhatsAppConnection(tx, {
        ...input,
        tenantId: context.tenant.id,
        userId: actor.userId,
        publicConnectionKey,
      }),
    );
    return NextResponse.json(
      { connection, publicConnectionKey, mode: "test_only" },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la conexión Meta." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
