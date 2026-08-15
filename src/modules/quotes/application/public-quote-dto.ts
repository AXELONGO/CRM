export type PublicQuoteDto = {
  quote: {
    number: string | null;
    title: string;
    status: string;
    currency: string;
    expiresAt: string | null;
    subtotalMinor: string;
    discountMinor: string;
    taxMinor: string;
    totalMinor: string;
  };
  items: Array<{
    description: string;
    quantity: string;
    unitPriceMinor: string;
    discountType: string;
    discountValue: string;
    taxRateBps: string;
    subtotalMinor: string;
    discountMinor: string;
    taxMinor: string;
    totalMinor: string;
  }>;
};

type PublicQuoteSource = {
  quote: {
    number: string | null;
    title: string;
    status: string;
    currency: string;
    expiresAt: Date | null;
    subtotalMinor: bigint;
    discountMinor: bigint;
    taxMinor: bigint;
    totalMinor: bigint;
  };
  items: Array<{
    description: string;
    quantity: string;
    unitPriceMinor: bigint;
    discountType: string;
    discountValue: bigint;
    taxRateBps: bigint;
    subtotalMinor: bigint;
    discountMinor: bigint;
    taxMinor: bigint;
    totalMinor: bigint;
  }>;
};

export function toPublicQuoteDto(input: PublicQuoteSource): PublicQuoteDto {
  return {
    quote: {
      number: input.quote.number,
      title: input.quote.title,
      status: input.quote.status,
      currency: input.quote.currency,
      expiresAt: input.quote.expiresAt?.toISOString() ?? null,
      subtotalMinor: input.quote.subtotalMinor.toString(),
      discountMinor: input.quote.discountMinor.toString(),
      taxMinor: input.quote.taxMinor.toString(),
      totalMinor: input.quote.totalMinor.toString(),
    },
    items: input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor.toString(),
      discountType: item.discountType,
      discountValue: item.discountValue.toString(),
      taxRateBps: item.taxRateBps.toString(),
      subtotalMinor: item.subtotalMinor.toString(),
      discountMinor: item.discountMinor.toString(),
      taxMinor: item.taxMinor.toString(),
      totalMinor: item.totalMinor.toString(),
    })),
  };
}
