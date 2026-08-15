import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getProject } from "@/modules/projects/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { ProjectTaskBoard } from "./project-task-board";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const { project, phases, tasks, checklistItems } = await withTenantDatabase(
    getDatabase(),
    context,
    (tx) => getProject(tx, context.tenant.id, projectId),
  );
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1100px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/projects`}
        >
          Proyectos
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          {project.number ?? "Borrador"} · {project.status} ·{" "}
          {project.preparationStatus}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Salud</p>
            <p className="mt-1 font-semibold">{project.health}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Fases</p>
            <p className="mt-1 font-semibold">{phases.length}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-[var(--crm-muted)]">Tareas</p>
            <p className="mt-1 font-semibold">{tasks.length}</p>
          </div>
        </div>
        <h2 className="mt-10 text-xl font-semibold">Kanban</h2>
        <ProjectTaskBoard
          tenantSlug={tenantSlug}
          projectId={projectId}
          initialTasks={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            reviewRequired: task.reviewRequired,
            blockedReason: task.blockedReason,
          }))}
          initialChecklist={checklistItems.map((item) => ({
            id: item.id,
            taskId: item.taskId,
            text: item.text,
            required: item.required,
            completed: item.completed,
          }))}
        />
      </section>
    </main>
  );
}