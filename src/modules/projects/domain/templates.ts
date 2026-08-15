import { createHash } from "node:crypto";

export type TemplateTask = {
  key: string;
  phaseKey: string;
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  reviewRequired?: boolean;
  checklist?: string[];
  dependencyKeys?: string[];
  dueOffsetDays?: number;
};

export type ProjectTemplateContent = {
  phases: { key: string; name: string; order: number }[];
  tasks: TemplateTask[];
};

export function normalizeTemplateContent(content: ProjectTemplateContent) {
  const phases = [...content.phases].sort((a, b) => a.order - b.order);
  const phaseKeys = new Set(phases.map((phase) => phase.key));
  if (!phases.length || !content.tasks.length)
    throw new Error("PROJECT_TEMPLATE_EMPTY");
  if (phaseKeys.size !== phases.length)
    throw new Error("PROJECT_TEMPLATE_DUPLICATE_PHASE");
  const taskKeys = new Set<string>();
  for (const task of content.tasks) {
    if (taskKeys.has(task.key)) throw new Error("PROJECT_TEMPLATE_DUPLICATE_TASK");
    if (!phaseKeys.has(task.phaseKey))
      throw new Error("PROJECT_TEMPLATE_PHASE_NOT_FOUND");
    if (!task.title.trim() || task.title.length > 240)
      throw new Error("PROJECT_TEMPLATE_TASK_INVALID");
    if (task.checklist && task.checklist.length > 50)
      throw new Error("PROJECT_TEMPLATE_CHECKLIST_LIMIT");
    taskKeys.add(task.key);
  }
  for (const task of content.tasks) {
    for (const dependency of task.dependencyKeys ?? []) {
      if (!taskKeys.has(dependency))
        throw new Error("PROJECT_TEMPLATE_DEPENDENCY_NOT_FOUND");
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byKey = new Map(content.tasks.map((task) => [task.key, task]));
  function visit(key: string) {
    if (visiting.has(key)) throw new Error("PROJECT_TEMPLATE_DEPENDENCY_CYCLE");
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)?.dependencyKeys ?? []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  for (const task of content.tasks) visit(task.key);
  return { phases, tasks: content.tasks } satisfies ProjectTemplateContent;
}

export function templateContentHash(content: ProjectTemplateContent) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeTemplateContent(content)))
    .digest("hex");
}

export function evaluateTemplateRules(
  rules: {
    priority: number;
    enabled: boolean;
    commercialModel?: string | null;
    templateId: string;
  }[],
  commercialModel: string,
) {
  const matches = rules
    .filter(
      (rule) =>
        rule.enabled &&
        (!rule.commercialModel || rule.commercialModel === commercialModel),
    )
    .sort((a, b) => b.priority - a.priority);
  if (!matches.length) return { status: "selection_required" as const };
  const highest = matches.filter((rule) => rule.priority === matches[0].priority);
  if (new Set(highest.map((rule) => rule.templateId)).size !== 1)
    return { status: "ambiguous" as const };
  return { status: "selected" as const, templateId: highest[0].templateId };
}
