import { describe, expect, it } from "vitest";
import { toPublicQuoteDto } from "../../src/modules/quotes/application/public-quote-dto";

describe("repro G-01: public quote HTTP serialization with boundary money values", () => {
  const source = {
    quote: {
      id: "quote-boundary",
      tenantId: "tenant-a",
      accountId: "account-a",
      number: "COT-1",
      status: "issued",
      title: "Boundary",
      currency: "MXN",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      subtotalMinor: 0n,
      discountMinor: 0n,
      taxMinor: 9007199254740993n,
      totalMinor: 9223372036854775807n,
    },
    items: [
      {
        id: "item-boundary",
        tenantId: "tenant-a",
        description: "Servicio",
        quantity: "1",
        unitPriceMinor: 9007199254740993n,
        discountType: "none",
        discountValue: 0n,
        taxRateBps: 0n,
        subtotalMinor: 9007199254740993n,
        discountMinor: 0n,
        taxMinor: 0n,
        totalMinor: 9223372036854775807n,
      },
    ],
  };

  it("maps every public monetary bigint to an exact decimal string", () => {
    const dto = toPublicQuoteDto(source);

    expect(dto.quote.totalMinor).toBe("9223372036854775807");
    expect(dto.quote.taxMinor).toBe("9007199254740993");
    expect(dto.items[0]?.unitPriceMinor).toBe("9007199254740993");
    expect(Object.keys(dto.quote).sort()).toEqual([
      "currency",
      "discountMinor",
      "expiresAt",
      "number",
      "status",
      "subtotalMinor",
      "taxMinor",
      "title",
      "totalMinor",
    ]);
    expect(JSON.stringify(dto)).not.toContain("tenant-a");
    expect(JSON.stringify(dto)).not.toContain("quote-boundary");
  });

  it("serializes the DTO without mutating BigInt.prototype", () => {
    const dto = toPublicQuoteDto(source);

    expect(Object.hasOwn(BigInt.prototype, "toJSON")).toBe(false);
    expect(() => JSON.stringify(dto)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(dto)) as {
      quote: { totalMinor: string };
      items: Array<{ totalMinor: string }>;
    };
    expect(parsed.quote.totalMinor).toBe("9223372036854775807");
    expect(parsed.items[0]?.totalMinor).toBe("9223372036854775807");
  });
});
