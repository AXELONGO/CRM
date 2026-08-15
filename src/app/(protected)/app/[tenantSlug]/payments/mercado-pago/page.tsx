import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import {
  mercadoPagoProfiles,
  paymentConnections,
} from "@/infrastructure/database/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function MercadoPagoPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const profile = await withTenantDatabase(getDatabase(), context, async (tx) => {
    const [row] = await tx
      .select({ connection: paymentConnections, profile: mercadoPagoProfiles })
      .from(paymentConnections)
      .leftJoin(
        mercadoPagoProfiles,
        and(
          eq(mercadoPagoProfiles.tenantId, paymentConnections.tenantId),
          eq(mercadoPagoProfiles.connectionId, paymentConnections.id),
        ),
      )
      .where(
        and(
          eq(paymentConnections.tenantId, context.tenant.id),
          eq(paymentConnections.provider, "mercadopago"),
        ),
      )
      .limit(1);
    return row;
  });
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-xl border bg-[var(--crm-surface)] p-8">
        <Link
          href={`/app/${tenantSlug}/settings/integrations`}
          className="text-sm text-[var(--crm-primary)]"
        >
          Integraciones
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Mercado Pago</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Simulación local. Mercado Pago procesa el pago para la agencia; CRM sólo
          conserva la conciliación.
        </p>
        <div className="mt-6 rounded-lg border p-4">
          <p className="font-medium">
            Estado: {profile?.profile?.status ?? "sin conectar"}
          </p>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            Cuenta: {profile?.profile?.nicknameMasked ?? "no disponible"}
          </p>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            Ambiente: {profile?.profile?.environment ?? "fake"}
          </p>
        </div>
        {!profile?.profile && (
          <p className="mt-6 text-sm">
            Usa el flujo de conexión server-side para iniciar una autorización simulada.
          </p>
        )}
      </section>
    </main>
  );
}
