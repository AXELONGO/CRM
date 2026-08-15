import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import {
  getPortalBrand,
  listPortalProjects,
} from "@/modules/portal/infrastructure/repositories";
import { PortalMessageForm } from "./portal-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, context } = await requireServerTenant(tenantSlug, "portal");
  const data = await withTenantDatabase(getDatabase(), context, async (tx) => ({
    brand: await getPortalBrand(tx, context.tenant.id),
    visibleProjects: await listPortalProjects(tx, {
      tenantId: context.tenant.id,
      userId: session.user.id,
    }),
  }));
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-5xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          {data.brand?.brandName ?? context.tenant.displayName}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Portal de proyectos</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Consulta avances y comunícate con el equipo de la agencia.
        </p>
        <p className="mt-4 text-sm text-[var(--crm-muted)]">
          Portal del cliente preparado.
        </p>
        {data.visibleProjects.length === 0 ? (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            No hay proyectos visibles para este acceso.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {data.visibleProjects.map(({ project }) => (
              <article className="rounded-xl border p-5" key={project.id}>
                <Link
                  className="rounded-xl"
                  href={`/portal/${tenantSlug}/projects/${project.id}`}
                >
                  <p className="block text-xs text-[var(--crm-muted)]">
                    {project.number ?? "Proyecto"} · {project.status}
                  </p>
                  <h2 className="mt-2 block text-xl font-semibold">
                    {project.name}
                  </h2>
                </Link>
                <p className="mt-3 text-sm text-[var(--crm-muted)]">
                  Actualizado {project.updatedAt.toLocaleDateString("es-MX")}
                </p>
                <PortalMessageForm tenantSlug={tenantSlug} projectId={project.id} />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
