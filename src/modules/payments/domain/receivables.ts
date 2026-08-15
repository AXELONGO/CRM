export function deriveInstallmentStatus(input: {
  amountMinor: bigint;
  paidAmountMinor: bigint;
  dueDate: string;
  today: string;
  planOpen: boolean;
}): "scheduled" | "open" | "partially_paid" | "paid" | "past_due" {
  if (input.paidAmountMinor >= input.amountMinor) return "paid";
  if (input.paidAmountMinor > BigInt(0)) return "partially_paid";
  if (!input.planOpen) return "scheduled";
  return input.dueDate < input.today ? "past_due" : "open";
}

export function calculateDepositStatus(required: bigint, satisfied: bigint) {
  if (required <= BigInt(0)) return "not_required" as const;
  return satisfied >= required ? ("satisfied" as const) : ("pending" as const);
}
