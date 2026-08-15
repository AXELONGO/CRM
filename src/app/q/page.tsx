"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicQuoteDto } from "@/modules/quotes/application/public-quote-dto";

function formatMinor(value: string, currency: string): string {
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).padStart(3, "0");
  const major = digits.slice(0, -2);
  const minor = digits.slice(-2);
  return `${negative ? "-" : ""}${major}.${minor} ${currency}`;
}

export default function PublicQuotePage() {
  const [quote, setQuote] = useState<PublicQuoteDto | null>(null);
  const [message, setMessage] = useState("Cargando cotización...");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(false);
  const [decision, setDecision] = useState("");
  const [comment, setComment] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const csrf = () =>
    document.cookie.match(/(?:^|; )quote_public_csrf=([^;]+)/)?.[1] ?? "";
  useEffect(() => {
    void (async () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
      if (token) {
        await fetch("/api/public/quotes/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        window.history.replaceState(null, "", window.location.pathname);
      }
      const response = await fetch("/api/public/quotes/current", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setQuote((await response.json()) as PublicQuoteDto);
    })().catch(() => setMessage("El enlace no es válido o la sesión expiró."));
  }, []);
  return (
    <main className="min-h-screen bg-[var(--crm-background)] px-6 py-10">
      <article className="mx-auto max-w-3xl rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        {quote ? (
          <>
            <p className="text-sm text-[var(--crm-muted)]">
              {quote.quote.number ?? "Cotización"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{quote.quote.title}</h1>
            <p className="mt-4">Estado: {quote.quote.status}</p>
            <ul className="mt-6 space-y-2">
              {quote.items.map((item, index) => (
                <li className="rounded border p-3" key={`${index}-${item.description}`}>
                  {item.description} · {item.quantity} ·{" "}
                  {formatMinor(item.totalMinor, quote.quote.currency)}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-semibold">
              Total: {formatMinor(quote.quote.totalMinor, quote.quote.currency)}
            </p>
            <a
              className="mt-3 inline-flex rounded border border-[var(--crm-border)] px-4 py-2 text-sm font-medium text-[var(--crm-primary)]"
              href="/api/public/quotes/pdf"
            >
              Descargar PDF
            </a>
            <div className="mt-8 space-y-3 border-t pt-6">
              <button
                className="rounded bg-[var(--crm-primary)] px-4 py-2 text-white"
                onClick={() =>
                  void fetch("/api/public/quotes/otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "request" }),
                  })
                }
              >
                Solicitar código
              </button>
              <label className="block text-sm">
                Código OTP
                <input
                  className="mt-1 block rounded border p-2"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
              </label>
              <button
                className="rounded border px-4 py-2"
                onClick={() =>
                  void fetch("/api/public/quotes/otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "verify", code: otp }),
                  })
                }
              >
                Verificar código
              </button>
              <label className="block text-sm">
                Nombre completo
                <input
                  className="mt-1 block rounded border p-2"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />{" "}
                He revisado esta versión y sus términos.
              </label>
              <div className="flex gap-2">
                <button
                  className="rounded bg-[var(--crm-primary)] px-4 py-2 text-white"
                  onClick={() =>
                    void fetch("/api/public/quotes/decision", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        decision: "accepted",
                        fullName,
                        consent,
                        csrfToken: decodeURIComponent(csrf()),
                        comment,
                        idempotencyKey: idempotencyKey.current,
                      }),
                    }).then((response) =>
                      setDecision(
                        response.ok ? "Decisión registrada" : "No se pudo registrar",
                      ),
                    )
                  }
                >
                  Aceptar
                </button>
                <button
                  className="rounded border px-4 py-2"
                  onClick={() =>
                    void fetch("/api/public/quotes/decision", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        decision: "changes_requested",
                        fullName,
                        consent,
                        csrfToken: decodeURIComponent(csrf()),
                        comment,
                        idempotencyKey: idempotencyKey.current,
                      }),
                    }).then((response) =>
                      setDecision(
                        response.ok ? "Solicitud registrada" : "No se pudo registrar",
                      ),
                    )
                  }
                >
                  Solicitar cambios
                </button>
                <label className="block text-sm sm:col-span-2">
                  Comentario
                  <textarea
                    className="mt-1 block w-full rounded border p-2"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
              </div>
              {decision ? (
                <p role="status" className="text-sm">
                  {decision}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p>{message}</p>
        )}
      </article>
    </main>
  );
}
