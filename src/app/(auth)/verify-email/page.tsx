"use client";

import { FormEvent, useState } from "react";

export default function VerifyEmailPage() {
  const [sent, setSent] = useState(false);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")).trim().toLowerCase(),
        callbackURL: `${window.location.origin}/verify-email`,
      }),
    });
    setSent(true);
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-md rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          CRM
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Verifica tu correo</h1>
        <p className="mt-4 text-[var(--crm-muted)]">
          Revisa tu bandeja de entrada para activar el acceso.
        </p>
        <form className="mt-8 space-y-5" onSubmit={resend}>
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
          <button
            className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
            type="submit"
          >
            Reenviar verificacion
          </button>
        </form>
        {sent ? (
          <p
            aria-live="polite"
            className="mt-5 text-sm text-[var(--crm-muted)]"
            role="status"
          >
            Si la cuenta puede recibir un correo, las instrucciones fueron enviadas.
          </p>
        ) : null}
        <a className="mt-6 inline-block text-sm" href="/login">
          Volver a iniciar sesion
        </a>
      </section>
    </main>
  );
}
