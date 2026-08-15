import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { listReceivablePlans } from "@/modules/payments/infrastructure/repositories";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const plans = await withTenantDatabase(getDatabase(), context, (tx) =>
    listReceivablePlans(tx, context.tenant.id),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1200px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          Inicio
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Cuentas por cobrar</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Vista operativa de planes de cobro. Las monedas se muestran por separado.
        </p>
        {plans.length === 0 ? (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            Todavía no hay planes de cobro.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Fuente</th>
                  <th className="p-3">Moneda</th>
                  <th className="p-3">Programado</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b">
                    <td className="p-3">
                      <Link
                        className="font-medium text-[var(--crm-primary)]"
                        href={`/app/${tenantSlug}/payments/receivables/${plan.id}`}
                      >
                        {plan.sourceNumber ?? plan.sourceKind}
                      </Link>
                    </td>
                    <td className="p-3">{plan.currency}</td>
                    <td className="p-3">{plan.scheduledTotalMinor.toString()}</td>
                    <td className="p-3">{plan.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
