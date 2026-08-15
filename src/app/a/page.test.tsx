import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicAgreementPage from "./page";

const baseView = {
  agreement: { number: "CTR-1", title: "Acuerdo de prueba", status: "issued" },
  version: {
    documentNumber: "CTR-1",
    versionNumber: 1,
    snapshot: {
      sections: [{ title: "Alcance", content: "Servicio de prueba." }],
    },
    contentSha256: "a".repeat(64),
  },
  recipient: { name: "Cliente de prueba", role: "Cliente", status: "available" },
  envelope: {
    status: "sent",
    signingOrder: "parallel",
    method: "internal_electronic_acceptance" as const,
    expiresAt: "2030-01-01T00:00:00.000Z",
  },
  session: {
    verified: false,
    otpLocked: false,
    otpNextRequestAt: null,
    expiresAt: "2030-01-01T00:00:00.000Z",
    canRequestOtp: true,
    canAct: false,
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PublicAgreementPage", () => {
  beforeEach(() => {
    document.cookie = "agreement_public_csrf=csrf-token-test; path=/";
    window.history.replaceState(null, "", "/a");
    vi.stubGlobal("crypto", { randomUUID: () => "agreement-action-key" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.cookie = "agreement_public_csrf=; Max-Age=0; path=/";
  });

  it("requests OTP, verifies it, and sends only the strict action body", async () => {
    let currentView = baseView;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = typeof input === "string" ? input : input.toString();
      if (path === "/api/public/agreements/current") return json(currentView);
      if (path === "/api/public/agreements/otp") {
        const body = JSON.parse(String(init?.body)) as { action: string };
        if (body.action === "verify") {
          currentView = {
            ...baseView,
            session: {
              ...baseView.session,
              verified: true,
              canRequestOtp: false,
              canAct: true,
            },
          };
          return json({ verified: true });
        }
        return json({ sent: true });
      }
      if (path === "/api/public/agreements/action")
        return json({ signaturesComplete: false });
      return json({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const rendered = render(<PublicAgreementPage />);
    expect(
      await screen.findByRole("heading", { name: "Acuerdo de prueba" }),
    ).toBeVisible();
    expect(screen.getByText("Servicio de prueba.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Solicitar código" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/public/agreements/otp",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    fireEvent.change(screen.getByLabelText("Código de verificación"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));
    expect(
      await screen.findByRole("heading", { name: "Registra tu decisión" }),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Cliente de prueba" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "Declaro que tengo facultad para actuar en nombre del destinatario.",
      ),
    );
    fireEvent.click(
      screen.getByLabelText(
        "He revisado el contenido y consiento registrar esta decisión electrónicamente.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aceptar acuerdo" }));

    await waitFor(() => {
      const actionCall = fetchMock.mock.calls.find(
        ([path]) => path === "/api/public/agreements/action",
      );
      expect(actionCall).toBeTruthy();
      const body = JSON.parse(String(actionCall?.[1]?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        action: "accepted",
        fullName: "Cliente de prueba",
        declaredAuthority: true,
        consent: true,
        csrfToken: "csrf-token-test",
        idempotencyKey: "agreement-action-key",
      });
      expect(body).not.toHaveProperty("recipientId");
      expect(body).not.toHaveProperty("agreementId");
    });
    expect(
      await screen.findByText(
        "La decisión quedó registrada. El acuerdo puede requerir otra firma.",
      ),
    ).toBeVisible();
    rendered.unmount();
  });

  it("does not expose OTP actions for a locked session", async () => {
    const lockedView = {
      ...baseView,
      session: { ...baseView.session, otpLocked: true, canRequestOtp: false },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(lockedView)),
    );

    const rendered = render(<PublicAgreementPage />);
    expect(
      await screen.findByText(
        "La verificación está bloqueada para esta sesión. Solicita un enlace nuevo al remitente.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Solicitar código" })).toBeNull();
    rendered.unmount();
  });
});
