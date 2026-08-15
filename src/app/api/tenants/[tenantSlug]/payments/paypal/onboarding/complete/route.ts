import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { completeFakePayPalOnboarding } from "@/modules/payments/infrastructure/paypal-repositories";
const schema = z.object({
  connectionId: z.string(),
  merchantId: z.string().regex(/^merchant_fake_[A-Za-z0-9_-]+$/),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.paypal.connect",
    );
    const input = schema.parse(await request.json());
    await withTenantDatabase(getDatabase(), context, (tx) =>
      completeFakePayPalOnboarding(tx, { tenantId: context.tenant.id, ...input }),
    );
    return NextResponse.json({ connected: true, mode: "test_only" });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo verificar la cuenta PayPal." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
