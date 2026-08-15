export type Currency = "MXN" | "USD";
export type Discount = { type: "none" | "percent" | "fixed"; value: bigint };
export type QuoteLineInput = {
  quantity: string;
  unitPriceMinor: bigint;
  discount: Discount;
  taxRateBps: bigint;
};
export type QuoteLineTotal = {
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxableMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

function quantityScale(value: string) {
  if (!/^\d{1,14}(?:\.\d{1,4})?$/.test(value)) throw new Error("QUANTITY_INVALID");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, "0") || 0);
}

export function calculateLine(input: QuoteLineInput): QuoteLineTotal {
  if (
    input.unitPriceMinor < BigInt(0) ||
    input.taxRateBps < BigInt(0) ||
    input.taxRateBps > BigInt(10000)
  )
    throw new Error("MONEY_INVALID");
  const quantity = quantityScale(input.quantity);
  const subtotalMinor =
    (quantity * input.unitPriceMinor + BigInt(5000)) / BigInt(10000);
  const discountMinor =
    input.discount.type === "none"
      ? BigInt(0)
      : input.discount.type === "fixed"
        ? input.discount.value
        : (subtotalMinor * input.discount.value + BigInt(5000)) / BigInt(10000);
  if (discountMinor < BigInt(0) || discountMinor > subtotalMinor)
    throw new Error("DISCOUNT_INVALID");
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = (taxableMinor * input.taxRateBps + BigInt(5000)) / BigInt(10000);
  return {
    subtotalMinor,
    discountMinor,
    taxableMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
  };
}

export function calculateTotals(lines: QuoteLineInput[]) {
  return lines.reduce(
    (total, line) => {
      const next = calculateLine(line);
      return {
        subtotalMinor: total.subtotalMinor + next.subtotalMinor,
        discountMinor: total.discountMinor + next.discountMinor,
        taxableMinor: total.taxableMinor + next.taxableMinor,
        taxMinor: total.taxMinor + next.taxMinor,
        totalMinor: total.totalMinor + next.totalMinor,
      };
    },
    {
      subtotalMinor: BigInt(0),
      discountMinor: BigInt(0),
      taxableMinor: BigInt(0),
      taxMinor: BigInt(0),
      totalMinor: BigInt(0),
    },
  );
}
