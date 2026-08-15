import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { paymentConnections, paypalProfiles } from "@/infrastructure/database/schema";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
export const dynamic = "force-dynamic";
export default async function PayPalPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const row = await withTenantDatabase(getDatabase(), context, (tx) =>
    tx
      .select({ connection: paymentConnections, profile: paypalProfiles })
      .from(paymentConnections)
      .leftJoin(
        paypalProfiles,
        and(
          eq(paypalProfiles.tenantId, paymentConnections.tenantId),
          eq(paypalProfiles.connectionId, paymentConnections.id),
        ),
      )
      .where(
        and(
          eq(paymentConnections.tenantId, context.tenant.id),
          eq(paymentConnections.provider, "paypal"),
        ),
      )
      .limit(1)
      .then(([result]) => result),
  );
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-xl border bg-[var(--crm-surface)] p-8">
        <Link
          href={`/app/${tenantSlug}/settings/integrations`}
          className="text-sm text-[var(--crm-primary)]"
        >
          Integraciones
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">PayPal Commerce Platform</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Simulación local. La agencia conserva su cuenta y PayPal liquida directamente
          al merchant.
        </p>
        <div className="mt-6 rounded-lg border p-4">
          <p className="font-medium">
            Estado: {row?.profile?.status ?? "sin conectar"}
          </p>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            Merchant: {row?.profile?.emailMasked ?? "no disponible"}
          </p>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            Cobros: {row?.profile?.paymentsReceivable ? "habilitados" : "no verificado"}
          </p>
        </div>
      </section>
    </main>
  );
}
