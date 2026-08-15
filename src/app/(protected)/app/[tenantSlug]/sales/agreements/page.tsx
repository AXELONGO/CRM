import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { listAgreements } from "@/modules/agreements/infrastructure/repositories";

export const dynamic = "force-dynamic";

export default async function AgreementsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const agreements = await withTenantDatabase(getDatabase(), context, (tx) =>
    listAgreements(tx, context.tenant.id),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1200px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/sales`}
        >
          Ventas
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Acuerdos y contratos</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Documentos derivados de cotizaciones aceptadas. Requieren revisión legal del
          tenant.
        </p>
        {agreements.length === 0 ? (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            Todavía no hay acuerdos.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Número</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((agreement) => (
                  <tr key={agreement.id} className="border-b">
                    <td className="p-3 font-medium">{agreement.number ?? "Draft"}</td>
                    <td className="p-3">{agreement.title}</td>
                    <td className="p-3">{agreement.status}</td>
                    <td className="p-3">{agreement.agreementType}</td>
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
