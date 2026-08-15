import { describe, expect, it } from "vitest";
import { renderQuotePdf } from "./quote-pdf";

describe("quote PDF", () => {
  it("renders a PDF document", async () => {
    const pdf = await renderQuotePdf({
      title: "Cotización de prueba",
      number: "COT-2026-0001",
      version: 1,
      currency: "MXN",
      customerName: "Cliente Test",
      lines: [{ description: "Servicio ficticio", quantity: "1", totalMinor: "10000" }],
      totalMinor: "10000",
      contentHash: "a".repeat(64),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
