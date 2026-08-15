import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { listProjects } from "@/modules/projects/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const projects = await withTenantDatabase(getDatabase(), context, (tx) =>
    listProjects(tx, context.tenant.id),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1200px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          Inicio
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Proyectos</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Trabajo interno derivado de oportunidades ganadas. La activación requiere
          cuatro gates.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["draft", "Borradores"],
            ["activation_pending", "Esperando activación"],
            ["active", "Activos"],
            ["on_hold", "En pausa"],
          ].map(([status, label]) => (
            <div key={status} className="rounded-lg border p-4">
              <p className="text-sm text-[var(--crm-muted)]">{label}</p>
              <p className="mt-1 text-2xl font-semibold">
                {projects.filter((project) => project.status === status).length}
              </p>
            </div>
          ))}
        </div>
        {projects.length === 0 ? (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            Una oportunidad ganada creará aquí un borrador de proyecto.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Proyecto</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Preparación</th>
                  <th className="p-3">Moneda</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b">
                    <td className="p-3">
                      <Link
                        className="font-medium text-[var(--crm-primary)]"
                        href={`/app/${tenantSlug}/projects/${project.id}`}
                      >
                        {project.number ?? "Draft"} · {project.name}
                      </Link>
                    </td>
                    <td className="p-3">{project.status}</td>
                    <td className="p-3">{project.preparationStatus}</td>
                    <td className="p-3">{project.currency}</td>
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
