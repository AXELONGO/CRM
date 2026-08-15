import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { getPortalProjectProgress } from "@/modules/portal/infrastructure/repositories";
import { PortalMessageForm } from "../../portal-client";

export const dynamic = "force-dynamic";

export default async function PortalProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const { session, context } = await requireServerTenant(tenantSlug, "portal");
  const data = await withTenantDatabase(getDatabase(), context, (tx) =>
    getPortalProjectProgress(tx, {
      tenantId: context.tenant.id,
      userId: session.user.id,
      projectId,
    }),
  );
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-5xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-7 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/portal/${tenantSlug}`}>
          Volver al portal
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          {data.project.number ?? "Proyecto"} · {data.project.status}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{data.project.name}</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Actualizado {new Date(data.project.updatedAt).toLocaleDateString("es-MX")}
        </p>
        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm text-[var(--crm-muted)]">Avance general</p>
          <p className="mt-1 text-2xl font-semibold">{data.progress.percent}%</p>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {data.progress.done} de {data.progress.total} tareas completadas
          </p>
          <div className="mt-3 h-2 rounded-full bg-[var(--crm-background)]">
            <div
              className="h-2 rounded-full bg-[var(--crm-primary)]"
              style={{ width: `${data.progress.percent}%` }}
            />
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {data.phases.map((phase) => {
            const taskRows = data.tasks.filter((task) => task.phaseId === phase.id);
            const done = taskRows.filter((task) => task.status === "done").length;
            return (
              <article className="rounded-xl border p-5" key={phase.id}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{phase.name}</h2>
                  <p className="text-sm text-[var(--crm-muted)]">
                    {done}/{taskRows.length}
                  </p>
                </div>
                <ul className="mt-3 space-y-2">
                  {taskRows.map((task) => {
                    const taskChecklist = data.checklist.filter(
                      (item) => item.taskId === task.id,
                    );
                    const completed =
                      task.status === "done" ||
                      (taskChecklist.length > 0 &&
                        taskChecklist.every((item) => item.completed));
                    return (
                      <li
                        className="flex items-center justify-between gap-2 rounded border p-3 text-sm"
                        key={task.id}
                      >
                        <span className={task.status === "done" ? "line-through" : ""}>
                          {task.title}
                        </span>
                        <span className="text-xs text-[var(--crm-muted)]">
                          {task.status}
                        </span>
                        <input
                          aria-label={`Tarea ${task.title}`}
                          checked={completed}
                          aria-readonly
                          disabled
                          type="checkbox"
                        />
                      </li>
                    );
                  })}
                  {taskRows.length === 0 ? (
                    <li className="text-sm text-[var(--crm-muted)]">Sin tareas.</li>
                  ) : null}
                </ul>
              </article>
            );
          })}
        </div>
        <PortalMessageForm tenantSlug={tenantSlug} projectId={projectId} />
      </section>
    </main>
  );
}