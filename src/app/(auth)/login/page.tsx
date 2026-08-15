"use client";

import { FormEvent, useState } from "react";
import { safeInternalPath } from "@/shared/presentation/safe-redirect";

function safeNext(): string {
  const value = new URLSearchParams(window.location.search).get("next");
  return safeInternalPath(value);
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
      }),
    });

    if (!response.ok) {
      setLoading(false);
      setError("No se pudo iniciar sesion. Verifica tus datos y tu correo.");
      return;
    }

    const result = (await response.json()) as { twoFactorRedirect?: boolean };
    setLoading(false);
    if (result.twoFactorRedirect) {
      setRequiresTotp(true);
      return;
    }

    window.location.assign(safeNext());
  }

  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/two-factor/verify-totp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code")), trustDevice: false }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("El codigo no es valido o ya vencio.");
      return;
    }
    window.location.assign(safeNext());
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-md rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          CRM
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Iniciar sesion</h1>
        <p className="mt-3 text-[var(--crm-muted)]">
          Usa una cuenta autorizada para continuar.
        </p>
        {requiresTotp ? (
          <form className="mt-8 space-y-5" onSubmit={verifyTotp}>
            <label className="block text-sm font-medium" htmlFor="code">
              Codigo de autenticacion
              <input
                required
                autoComplete="one-time-code"
                className="mt-2 w-full rounded-lg border border-[var(--crm-border)] px-3 py-3"
                id="code"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="code"
                pattern="[0-9]{6}"
              />
            </label>
            {error ? (
              <p aria-live="polite" className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Verificando..." : "Verificar codigo"}
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium" htmlFor="email">
              Correo
              <input
                required
                autoComplete="email"
                className="mt-2 w-full rounded-lg border border-[var(--crm-border)] px-3 py-3"
                id="email"
                name="email"
                type="email"
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="password">
              Contrasena
              <input
                required
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg border border-[var(--crm-border)] px-3 py-3"
                id="password"
                name="password"
                type="password"
              />
            </label>
            {error ? (
              <p aria-live="polite" className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Comprobando..." : "Entrar"}
            </button>
          </form>
        )}
        <a className="mt-6 inline-block text-sm" href="/forgot-password">
          Olvide mi contrasena
        </a>
      </section>
    </main>
  );
}
