export const AUTOMATION_ACTIONS = [
  "assign_owner",
  "assign_queue",
  "create_reminder",
  "create_notification",
  "create_activity",
  "update_opportunity_stage",
  "update_opportunity_field",
  "send_email",
  "emit_event",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number];
export type ConditionOperator =
  "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "gte" | "lt" | "lte" | "exists";
export type AutomationDefinition = {
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
};
export type AutomationCondition = {
  path: string;
  operator: ConditionOperator;
  value?: unknown;
};
export type AutomationAction = {
  type: AutomationActionType;
  params: Record<string, unknown>;
};

const MAX_CONDITIONS = 32;
const MAX_ACTIONS = 16;
const MAX_DEPTH = 5;

export function validateAutomationDefinition(
  definition: unknown,
): AutomationDefinition {
  if (!definition || typeof definition !== "object" || Array.isArray(definition))
    throw new Error("invalid_definition");
  const value = definition as Record<string, unknown>;
  const conditions = value.conditions ?? [];
  const actions = value.actions;
  if (!Array.isArray(conditions) || conditions.length > MAX_CONDITIONS)
    throw new Error("invalid_conditions");
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > MAX_ACTIONS)
    throw new Error("invalid_actions");
  const normalizedConditions = conditions.map((condition) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition))
      throw new Error("invalid_condition");
    const item = condition as Record<string, unknown>;
    if (
      typeof item.path !== "string" ||
      !/^[a-zA-Z][a-zA-Z0-9_.]{0,127}$/.test(item.path)
    )
      throw new Error("invalid_condition_path");
    if (
      ![
        "eq",
        "neq",
        "in",
        "not_in",
        "contains",
        "gt",
        "gte",
        "lt",
        "lte",
        "exists",
      ].includes(String(item.operator))
    )
      throw new Error("invalid_condition_operator");
    return {
      path: item.path,
      operator: item.operator as ConditionOperator,
      value: item.value,
    };
  });
  const normalizedActions = actions.map((action) => {
    if (!action || typeof action !== "object" || Array.isArray(action))
      throw new Error("invalid_action");
    const item = action as Record<string, unknown>;
    if (!AUTOMATION_ACTIONS.includes(item.type as AutomationActionType))
      throw new Error("invalid_action_type");
    if (!item.params || typeof item.params !== "object" || Array.isArray(item.params))
      throw new Error("invalid_action_params");
    return {
      type: item.type as AutomationActionType,
      params: item.params as Record<string, unknown>,
    };
  });
  return { conditions: normalizedConditions, actions: normalizedActions };
}

function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      payload,
    );
}

function compare(
  actual: unknown,
  operator: ConditionOperator,
  expected: unknown,
): boolean {
  if (operator === "exists")
    return expected === undefined
      ? actual !== undefined
      : Boolean(actual) === Boolean(expected);
  if (operator === "in" || operator === "not_in") {
    if (!Array.isArray(expected)) return false;
    const result = expected.some((item) => Object.is(item, actual));
    return operator === "in" ? result : !result;
  }
  if (operator === "contains")
    return Array.isArray(actual)
      ? actual.some((item) => Object.is(item, expected))
      : typeof actual === "string" &&
          typeof expected === "string" &&
          actual.includes(expected);
  if (operator === "eq") return Object.is(actual, expected);
  if (operator === "neq") return !Object.is(actual, expected);
  if (operator === "gt")
    return (
      typeof actual === "number" && typeof expected === "number" && actual > expected
    );
  if (operator === "gte")
    return (
      typeof actual === "number" && typeof expected === "number" && actual >= expected
    );
  if (operator === "lt")
    return (
      typeof actual === "number" && typeof expected === "number" && actual < expected
    );
  return (
    typeof actual === "number" && typeof expected === "number" && actual <= expected
  );
}

export function evaluateAutomation(
  definition: AutomationDefinition,
  payload: Record<string, unknown>,
  causationDepth: number,
) {
  if (causationDepth > MAX_DEPTH)
    return { matched: false, reason: "causation_depth_exceeded" as const, actions: [] };
  const conditions = definition.conditions ?? [];
  const matched = conditions.every((condition) =>
    compare(readPath(payload, condition.path), condition.operator, condition.value),
  );
  return {
    matched,
    reason: matched ? ("matched" as const) : ("conditions_not_met" as const),
    actions: matched ? definition.actions : [],
  };
}

export function renderTemplate(
  value: unknown,
  payload: Record<string, unknown>,
): unknown {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{([a-zA-Z][a-zA-Z0-9_.]{0,127})\}\}/g, (_, path: string) => {
    const result = readPath(payload, path);
    return result === undefined || result === null ? "" : String(result);
  });
}

export function actionIdempotencyKey(
  tenantId: string,
  eventId: string,
  ruleVersionId: string,
  actionIndex: number,
) {
  return `${tenantId}:${eventId}:${ruleVersionId}:${actionIndex}`;
}
