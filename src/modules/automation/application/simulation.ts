import {
  evaluateAutomation,
  validateAutomationDefinition,
  type AutomationDefinition,
} from "../domain/engine";

export function simulateAutomationRule(input: {
  definition: unknown;
  payload: Record<string, unknown>;
  causationDepth?: number;
}) {
  const definition: AutomationDefinition = validateAutomationDefinition(
    input.definition,
  );
  const result = evaluateAutomation(
    definition,
    input.payload,
    input.causationDepth ?? 0,
  );
  return {
    matched: result.matched,
    reason: result.reason,
    actions: result.actions.map((action) => ({
      type: action.type,
      params: action.params,
    })),
  };
}
