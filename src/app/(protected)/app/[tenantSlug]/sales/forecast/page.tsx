import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { forecast } from "@/modules/sales/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";

export const dynamic = "force-dynamic";
export default async function ForecastPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const rows = await withTenantDatabase(getDatabase(), context, (tx) =>
    forecast(tx, { tenantId: context.tenant.id }),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-5xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/sales`}
        >
          Oportunidades
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Forecast</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Valor abierto y ponderado por moneda, sin conversiones implícitas.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <article className="rounded-lg border p-5" key={row.currency}>
              <p className="text-sm text-[var(--crm-muted)]">{row.currency}</p>
              <p className="mt-2 text-2xl font-semibold">
                {(row.openMinor / 100).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                Ponderado: {(row.weightedMinor / 100).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--crm-muted)]">
            No hay oportunidades abiertas con valor pronosticable.
          </p>
        ) : null}
      </section>
    </main>
  );
}
