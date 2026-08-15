import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import {
  listContent,
  listIdeas,
  listNotes,
} from "@/modules/content-planning/infrastructure/repositories";

export const dynamic = "force-dynamic";
export default async function ContentPlanningPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const data = await withTenantDatabase(getDatabase(), context, async (tx) => ({
    content: await listContent(tx, context.tenant.id),
    ideas: await listIdeas(tx, context.tenant.id),
    notes: await listNotes(tx, context.tenant.id),
  }));
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-6xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          Inicio
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Planificación editorial</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Ideas, notas y agenda interna. Programado no significa publicado fuera del
          CRM.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Ideas backlog</p>
            <p className="mt-1 text-2xl font-semibold">{data.ideas.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Notas internas</p>
            <p className="mt-1 text-2xl font-semibold">{data.notes.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Contenido planeado</p>
            <p className="mt-1 text-2xl font-semibold">{data.content.length}</p>
          </div>
        </div>
        <h2 className="mt-10 text-xl font-semibold">Agenda</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Título</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Zona horaria</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((item) => (
                <tr className="border-b" key={item.id}>
                  <td className="p-3 font-medium">{item.title}</td>
                  <td className="p-3">{item.state}</td>
                  <td className="p-3">{item.plannedDate ?? "Backlog"}</td>
                  <td className="p-3">{item.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
