"use client";

import { FormEvent, useState } from "react";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const token = new URLSearchParams(window.location.search).get("token");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));

    if (!token || password !== confirmation || password.length < 12) {
      setError("El enlace o la nueva contrasena no son validos.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword: password, token }),
    });

    if (!response.ok) {
      setError("El enlace no es valido o ya expiro.");
      return;
    }

    setMessage("La contrasena fue actualizada. Ya puedes iniciar sesion.");
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-md rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          CRM
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Nueva contrasena</h1>
        {message ? (
          <p aria-live="polite" className="mt-6 text-green-700" role="status">
            {message} <a href="/login">Iniciar sesion</a>
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium" htmlFor="password">
              Nueva contrasena
              <input
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-[var(--crm-border)] px-3 py-3"
                id="password"
                name="password"
                type="password"
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="confirmation">
              Confirmar contrasena
              <input
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-[var(--crm-border)] px-3 py-3"
                id="confirmation"
                name="confirmation"
                type="password"
              />
            </label>
            {error ? (
              <p aria-live="polite" className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
              type="submit"
            >
              Actualizar contrasena
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
