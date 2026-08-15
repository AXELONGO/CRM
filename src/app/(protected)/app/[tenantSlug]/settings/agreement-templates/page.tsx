import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { listAgreementTemplates } from "@/modules/agreements/infrastructure/repositories";

export const dynamic = "force-dynamic";

export default async function AgreementTemplatesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const templates = await withTenantDatabase(getDatabase(), context, (tx) =>
    listAgreementTemplates(tx, context.tenant.id),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1200px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          CRM
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Plantillas de acuerdos</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Las plantillas son versiones copiadas al documento. El CRM no certifica
          revisión legal.
        </p>
        {templates.length === 0 ? (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            No hay plantillas configuradas.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Pricing</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b">
                    <td className="p-3 font-medium">{template.name}</td>
                    <td className="p-3">{template.documentType}</td>
                    <td className="p-3">{template.pricingModel}</td>
                    <td className="p-3">{template.status}</td>
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
