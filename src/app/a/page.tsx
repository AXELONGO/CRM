"use client";

import { useEffect, useRef, useState } from "react";

type PublicView = {
  agreement: { number: string | null; title: string; status: string };
  version: {
    documentNumber: string;
    versionNumber: number;
    snapshot: Record<string, unknown>;
    contentSha256: string;
  };
  recipient: { name: string; role: string; status: string };
  envelope: {
    status: string;
    signingOrder: string;
    method: "internal_electronic_acceptance" | "external_signed_pdf";
    expiresAt: string;
  };
  session: {
    verified: boolean;
    otpLocked: boolean;
    otpNextRequestAt: string | null;
    expiresAt: string;
    canRequestOtp: boolean;
    canAct: boolean;
  };
};

type AgreementAction = "accepted" | "declined" | "changes_requested";

function getCsrfToken(): string {
  const encoded = document.cookie.match(/(?:^|; )agreement_public_csrf=([^;]+)/)?.[1];
  if (!encoded) return "";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "";
  }
}

function getSections(snapshot: Record<string, unknown>) {
  const values = snapshot.sections;
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const section = value as Record<string, unknown>;
    if (typeof section.title !== "string" || typeof section.content !== "string")
      return [];
    return [{ title: section.title, content: section.content }];
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function PublicAgreementPage() {
  const [view, setView] = useState<PublicView | null>(null);
  const [message, setMessage] = useState("Cargando documento...");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [declaredAuthority, setDeclaredAuthority] = useState(false);
  const [consent, setConsent] = useState(false);
  const [comment, setComment] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<AgreementAction | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);

  async function loadView() {
    const response = await fetch("/api/public/agreements/current", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("AGREEMENT_SESSION_INVALID");
    const next = (await response.json()) as PublicView;
    setView(next);
    return next;
  }

  useEffect(() => {
    void (async () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
      if (token) {
        const exchange = await fetch("/api/public/agreements/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!exchange.ok) throw new Error("AGREEMENT_LINK_INVALID");
        window.history.replaceState(null, "", window.location.pathname);
      }
      await loadView();
    })().catch(() => setMessage("El enlace no es válido o la sesión expiró."));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function requestOtp() {
    if (!view?.session.canRequestOtp) return;
    setOtpBusy(true);
    try {
      const response = await fetch("/api/public/agreements/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      if (!response.ok) throw new Error("OTP_REQUEST_FAILED");
      await loadView();
      setMessage("Enviamos un código de verificación al correo del destinatario.");
    } catch {
      setMessage("No se pudo solicitar el código. Inténtalo más tarde.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setMessage("Escribe los seis dígitos del código.");
      return;
    }
    setOtpBusy(true);
    try {
      const response = await fetch("/api/public/agreements/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: otp }),
      });
      if (!response.ok) throw new Error("OTP_VERIFY_FAILED");
      setOtp("");
      await loadView();
      setMessage("Código verificado. Ya puedes registrar tu decisión.");
    } catch {
      setMessage("El código no es válido o ya expiró.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function submitAction(action: AgreementAction) {
    if (!view?.session.canAct) return;
    if (!fullName.trim() || !declaredAuthority || !consent) {
      setMessage(
        "Confirma tu nombre, facultad para actuar y consentimiento antes de continuar.",
      );
      return;
    }
    const fingerprint = JSON.stringify({
      action,
      fullName: fullName.trim(),
      declaredAuthority,
      consent,
      comment: comment.trim(),
    });
    if (!idempotency.current || idempotency.current.fingerprint !== fingerprint) {
      idempotency.current = { fingerprint, key: crypto.randomUUID() };
    }
    setSubmittingAction(action);
    try {
      const response = await fetch("/api/public/agreements/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          fullName: fullName.trim(),
          declaredAuthority,
          consent,
          csrfToken: getCsrfToken(),
          idempotencyKey: idempotency.current.key,
          comment: comment.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { signaturesComplete?: boolean };
      if (!response.ok) throw new Error("AGREEMENT_ACTION_FAILED");
      await loadView();
      setMessage(
        result.signaturesComplete
          ? "La aceptación quedó registrada y el acuerdo está completo."
          : "La decisión quedó registrada. El acuerdo puede requerir otra firma.",
      );
    } catch {
      setMessage(
        "No se pudo registrar la decisión. Verifica los datos e inténtalo de nuevo.",
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  const nextRequestAt = view?.session.otpNextRequestAt
    ? new Date(view.session.otpNextRequestAt).getTime()
    : null;
  const cooldownSeconds = nextRequestAt
    ? Math.max(0, Math.ceil((nextRequestAt - now) / 1_000))
    : 0;
  const canRequestOtp = Boolean(view?.session.canRequestOtp) && cooldownSeconds === 0;
  const envelopeExpired = view
    ? new Date(view.envelope.expiresAt).getTime() <= now
    : false;
  const sections = view ? getSections(view.version.snapshot) : [];

  return (
    <main className="min-h-screen bg-[var(--crm-background)] px-6 py-10">
      <article className="mx-auto max-w-3xl rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        {view ? (
          <>
            <p className="text-sm text-[var(--crm-muted)]">
              Documento {view.version.documentNumber} · Versión{" "}
              {view.version.versionNumber}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{view.agreement.title}</h1>
            <p className="mt-4 text-sm">
              Destinatario: {view.recipient.name} ({view.recipient.role})
            </p>
            <p className="mt-3 text-sm text-[var(--crm-muted)]">
              Vigencia: {formatDate(view.envelope.expiresAt)}
            </p>
            <p
              className="mt-6 rounded bg-[var(--crm-background)] p-4 text-sm"
              role="status"
            >
              Estado: {view.envelope.status}. Esta aceptación es electrónica simple y no
              constituye firma electrónica avanzada.
            </p>

            <section className="mt-8 border-t border-[var(--crm-border)] pt-6">
              <h2 className="text-lg font-semibold">Contenido del acuerdo</h2>
              {sections.length ? (
                <div className="mt-4 space-y-5">
                  {sections.map((section, index) => (
                    <section key={`${index}-${section.title}`}>
                      <h3 className="font-medium">{section.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {section.content}
                      </p>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--crm-muted)]">
                  No hay secciones legibles disponibles para este documento.
                </p>
              )}
            </section>

            <p className="mt-6 break-all text-xs text-[var(--crm-muted)]">
              Hash de contenido: {view.version.contentSha256}
            </p>

            {view.envelope.method === "external_signed_pdf" ? (
              <p className="mt-8 rounded border border-[var(--crm-border)] p-4 text-sm">
                Este acuerdo requiere un PDF firmado externamente. Contacta al remitente
                para continuar.
              </p>
            ) : envelopeExpired ? (
              <p className="mt-8 rounded border border-[var(--crm-border)] p-4 text-sm">
                El periodo para registrar esta decisión expiró.
              </p>
            ) : view.session.otpLocked ? (
              <p className="mt-8 rounded border border-[var(--crm-border)] p-4 text-sm">
                La verificación está bloqueada para esta sesión. Solicita un enlace
                nuevo al remitente.
              </p>
            ) : !view.session.verified ? (
              <section className="mt-8 space-y-3 border-t border-[var(--crm-border)] pt-6">
                <h2 className="text-lg font-semibold">Verifica tu correo</h2>
                <p className="text-sm text-[var(--crm-muted)]">
                  Te enviaremos un código de seis dígitos al correo del destinatario.
                </p>
                <button
                  className="rounded bg-[var(--crm-primary)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={otpBusy || !canRequestOtp}
                  onClick={() => void requestOtp()}
                  type="button"
                >
                  {view.session.otpNextRequestAt
                    ? "Reenviar código"
                    : "Solicitar código"}
                </button>
                {cooldownSeconds > 0 ? (
                  <p className="text-sm text-[var(--crm-muted)]">
                    Podrás solicitar otro código en {cooldownSeconds} s.
                  </p>
                ) : null}
                <label className="block max-w-xs text-sm">
                  Código de verificación
                  <input
                    autoComplete="one-time-code"
                    className="mt-1 block w-full rounded border border-[var(--crm-border)] p-2"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    value={otp}
                  />
                </label>
                <button
                  className="rounded border border-[var(--crm-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={otpBusy || otp.length !== 6}
                  onClick={() => void verifyOtp()}
                  type="button"
                >
                  Verificar código
                </button>
              </section>
            ) : view.session.canAct ? (
              <form
                className="mt-8 space-y-4 border-t border-[var(--crm-border)] pt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction("accepted");
                }}
              >
                <h2 className="text-lg font-semibold">Registra tu decisión</h2>
                <label className="block max-w-xl text-sm">
                  Nombre completo
                  <input
                    className="mt-1 block w-full rounded border border-[var(--crm-border)] p-2"
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    value={fullName}
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    checked={declaredAuthority}
                    onChange={(event) => setDeclaredAuthority(event.target.checked)}
                    type="checkbox"
                  />
                  Declaro que tengo facultad para actuar en nombre del destinatario.
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    type="checkbox"
                  />
                  He revisado el contenido y consiento registrar esta decisión
                  electrónicamente.
                </label>
                <label className="block max-w-xl text-sm">
                  Comentario opcional
                  <textarea
                    className="mt-1 block min-h-24 w-full rounded border border-[var(--crm-border)] p-2"
                    maxLength={2000}
                    onChange={(event) => setComment(event.target.value)}
                    value={comment}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-[var(--crm-primary)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submittingAction !== null}
                    type="submit"
                  >
                    Aceptar acuerdo
                  </button>
                  <button
                    className="rounded border border-[var(--crm-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submittingAction !== null}
                    onClick={() => void submitAction("changes_requested")}
                    type="button"
                  >
                    Solicitar cambios
                  </button>
                  <button
                    className="rounded border border-[var(--crm-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submittingAction !== null}
                    onClick={() => void submitAction("declined")}
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-8 rounded border border-[var(--crm-border)] p-4 text-sm">
                La decisión ya fue registrada o el acuerdo no está disponible para otra
                acción.
              </p>
            )}

            <p aria-live="polite" className="mt-5 text-sm" role="status">
              {message}
            </p>
          </>
        ) : (
          <p aria-live="polite" role="status">
            {message}
          </p>
        )}
      </article>
    </main>
  );
}
