export type GateResult = {
  type: "accepted_quote" | "deposit" | "internal_approval" | "executed_agreement";
  status: "pending" | "satisfied" | "failed" | "unavailable" | "stale";
  reasonCode: string;
  humanMessage: string;
};

export function activationReadiness(gates: GateResult[]) {
  if (gates.some((gate) => gate.status === "unavailable")) return "error" as const;
  if (gates.some((gate) => gate.status === "failed" || gate.status === "stale"))
    return "blocked" as const;
  if (gates.some((gate) => gate.status === "pending")) return "waiting" as const;
  return "ready" as const;
}

export function assertProjectTransition(from: string, to: string) {
  const valid =
    (from === "draft" && ["activation_pending", "cancelled"].includes(to)) ||
    (from === "activation_pending" && ["draft", "active", "cancelled"].includes(to)) ||
    (from === "active" && ["on_hold", "completed", "cancelled"].includes(to)) ||
    (from === "on_hold" && ["active", "completed", "cancelled"].includes(to)) ||
    ((from === "completed" || from === "cancelled") && to === "archived");
  if (!valid) throw new Error("PROJECT_TRANSITION_INVALID");
}
