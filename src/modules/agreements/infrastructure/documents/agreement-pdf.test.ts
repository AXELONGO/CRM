import { describe, expect, it } from "vitest";
import { renderAgreementPdf } from "./agreement-pdf";

describe("agreement PDF renderer", () => {
  it("renders a private deterministic document payload", async () => {
    const pdf = await renderAgreementPdf({
      title: "Documento de prueba",
      documentNumber: "CTR-2026-0001",
      version: 1,
      contentHash: "a".repeat(64),
      providerName: "Proveedor Test",
      customerName: "Cliente Test",
      sections: [{ title: "Alcance", content: "Contenido ficticio." }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
