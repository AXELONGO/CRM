"use client";

import { useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  reviewRequired: boolean;
  blockedReason: string | null;
};

type ChecklistItem = {
  id: string;
  taskId: string;
  text: string;
  required: boolean;
  completed: boolean;
};

const statusLabels: Record<string, string> = {
  todo: "Por hacer",
  in_progress: "En progreso",
  review: "Revisión",
  blocked: "Bloqueado",
  done: "Hecho",
  cancelled: "Cancelado",
};

const nextStatus: Record<string, string> = {
  todo: "in_progress",
  in_progress: "review",
  review: "done",
};

const flow: string[] = ["todo", "in_progress", "review", "blocked", "done"];

export function ProjectTaskBoard({
  tenantSlug,
  projectId,
  initialTasks,
  initialChecklist,
}: {
  tenantSlug: string;
  projectId: string;
  initialTasks: Task[];
  initialChecklist: ChecklistItem[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/tenants/${tenantSlug}/projects/${projectId}/tasks`;

  async function post(body: Record<string, unknown>) {
    const response = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "No se pudo actualizar la tarea.");
    }
  }

  async function move(taskId: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "move_status", taskId, status });
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, status } : task,
        ),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(itemId: string) {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "toggle_checklist", itemId });
      setChecklist((current) =>
        current.map((item) =>
          item.id === itemId ? { ...item, completed: !item.completed } : item,
        ),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {error ? (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-5">
        {flow.map((status) => (
          <div
            key={status}
            className="min-h-32 rounded-lg border bg-[var(--crm-background)] p-3"
          >
            <h3 className="text-sm font-semibold">{statusLabels[status]}</h3>
            <div className="mt-3 space-y-2">
              {tasks
                .filter((task) => task.status === status)
                .map((task) => (
                  <article
                    key={task.id}
                    className="rounded border bg-white p-3 text-sm"
                  >
                    <p className="font-medium">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 text-xs text-[var(--crm-muted)]">
                        {task.description}
                      </p>
                    ) : null}
                    {task.blockedReason ? (
                      <p className="mt-1 text-xs text-red-700">
                        Motivo: {task.blockedReason}
                      </p>
                    ) : null}
                    <div className="mt-2 space-y-1">
                      {checklist
                        .filter((item) => item.taskId === task.id)
                        .map((item) => (
                          <label
                            className="flex items-center gap-2 text-xs"
                            key={item.id}
                          >
                            <input
                              checked={item.completed}
                              disabled={busy}
                              onChange={() => void toggle(item.id)}
                              type="checkbox"
                            />
                            <span className={item.completed ? "line-through" : ""}>
                              {item.text}
                            </span>
                          </label>
                        ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.status === "blocked" ? (
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void move(task.id, "in_progress")}
                          type="button"
                          title="Desbloquear"
                        >
                          Desbloquear
                        </button>
                      ) : null}
                      {task.status === "review" ? (
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void move(task.id, "blocked")}
                          type="button"
                          title="Bloquear"
                        >
                          Bloquear
                        </button>
                      ) : null}
                      {["todo", "in_progress", "review"].includes(task.status) ? (
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void move(task.id, nextStatus[task.status])}
                          type="button"
                        >
                          Avanzar →
                        </button>
                      ) : null}
                      {task.status !== "done" && task.status !== "cancelled" ? (
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => void move(task.id, "done")}
                          type="button"
                          title="Marcar hecho"
                        >
                          ✓
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}