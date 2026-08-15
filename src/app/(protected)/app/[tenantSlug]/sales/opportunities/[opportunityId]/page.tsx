import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { getOpportunity } from "@/modules/sales/infrastructure/repositories";
import { OpportunityJourney } from "./opportunity-journey";

export const dynamic = "force-dynamic";
export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; opportunityId: string }>;
}) {
  const { tenantSlug, opportunityId } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const detail = await withTenantDatabase(getDatabase(), context, (tx) =>
    getOpportunity(tx, context.tenant.id, opportunityId),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-4xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/sales`}
        >
          Volver al pipeline
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{detail.opportunity.title}</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Estado: {detail.opportunity.state} · {detail.opportunity.currency}{" "}
          {(detail.opportunity.estimatedValueMinor / 100).toLocaleString()}
        </p>
        <OpportunityJourney
          tenantSlug={tenantSlug}
          opportunityId={opportunityId}
          opportunity={{
            state: detail.opportunity.state,
            currency: detail.opportunity.currency,
            estimatedValueMinor: detail.opportunity.estimatedValueMinor,
            version: detail.opportunity.version,
          }}
        />
        <h2 className="mt-8 text-lg font-semibold">Actividades</h2>
        <ul className="mt-3 grid gap-2">
          {detail.activities.map((activity) => (
            <li className="rounded border p-3 text-sm" key={activity.id}>
              <strong>{activity.title}</strong>
              <span className="ml-2 text-slate-500">{activity.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
