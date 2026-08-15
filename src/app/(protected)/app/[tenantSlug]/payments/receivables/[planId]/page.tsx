import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getReceivablePlan } from "@/modules/payments/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";

export const dynamic = "force-dynamic";

export default async function ReceivablePlanPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; planId: string }>;
}) {
  const { tenantSlug, planId } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const { plan, installments } = await withTenantDatabase(
    getDatabase(),
    context,
    (tx) => getReceivablePlan(tx, context.tenant.id, planId),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1000px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/payments/receivables`}
        >
          Cuentas por cobrar
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Detalle del plan</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          {plan.sourceNumber ?? plan.sourceKind} · hash {plan.sourceHash.slice(0, 12)}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Total esperado</p>
            <p className="mt-1 text-xl font-semibold">
              {plan.expectedTotalMinor.toString()} {plan.currency}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Programado</p>
            <p className="mt-1 text-xl font-semibold">
              {plan.scheduledTotalMinor.toString()} {plan.currency}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Estado</p>
            <p className="mt-1 text-xl font-semibold">{plan.status}</p>
          </div>
        </div>
        <h2 className="mt-10 text-xl font-semibold">Cuotas</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Cuota</th>
                <th className="p-3">Vencimiento</th>
                <th className="p-3">Importe</th>
                <th className="p-3">Pagado</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((installment) => (
                <tr key={installment.id} className="border-b">
                  <td className="p-3">{installment.label}</td>
                  <td className="p-3">{installment.dueDate}</td>
                  <td className="p-3">
                    {installment.amountMinor.toString()} {installment.currency}
                  </td>
                  <td className="p-3">
                    {installment.paidAmountMinor.toString()} {installment.currency}
                  </td>
                  <td className="p-3">{installment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
