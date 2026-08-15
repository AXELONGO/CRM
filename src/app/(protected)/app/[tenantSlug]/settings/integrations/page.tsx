import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { getIntegrationCatalog } from "@/modules/integrations/domain/catalog";
import { listIntegrationConnections } from "@/modules/integrations/infrastructure/repositories";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const connections = await withTenantDatabase(getDatabase(), context, (tx) =>
    listIntegrationConnections(tx, context.tenant.id),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-6xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          Inicio
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Centro de integraciones</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Modo de prueba: no se contactará a Meta.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {getIntegrationCatalog().map((item) => (
            <article className="rounded-xl border p-5" key={item.code}>
              <p className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">
                {item.category}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{item.name}</h2>
              <p className="mt-2 text-sm">
                {item.code === "waha"
                  ? "Disponible en simulación local. WAHA es un conector no oficial basado en WhatsApp Web."
                  : item.status === "available"
                    ? "Disponible sólo para configuración y fixtures locales."
                    : "Próximamente"}
              </p>
            </article>
          ))}
        </div>
        <h2 className="mt-10 text-xl font-semibold">Conexiones configuradas</h2>
        <div className="mt-4 space-y-3">
          {connections.length === 0 ? (
            <p className="rounded border border-dashed p-6 text-sm text-[var(--crm-muted)]">
              No hay conexiones.
            </p>
          ) : (
            connections.map(({ connection, meta }) => (
              <div className="rounded-lg border p-4" key={connection.id}>
                <p className="font-semibold">{connection.displayName}</p>
                <p className="mt-1 text-sm text-[var(--crm-muted)]">
                  {connection.providerCode} · {connection.status} ·{" "}
                  {meta?.phoneNumberId ?? "sin phone ID"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
