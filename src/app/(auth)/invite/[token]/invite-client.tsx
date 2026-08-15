"use client";

import { FormEvent, useState } from "react";

export function InviteClient({
  token,
  email,
}: {
  token: string;
  email: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    let response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
    });
    if (!response.ok && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
    }
    if (!response.ok) {
      setError("La invitacion no es valida o requiere otra cuenta verificada.");
      return;
    }
    const result = (await response.json()) as { tenantSlug: string; roles: string[] };
    const area = result.roles.includes("client") ? "portal" : "app";
    // A full navigation refreshes the server session before resolving tenant access.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    globalThis.location.href = `/${area}/${encodeURIComponent(result.tenantSlug)}`;
  }

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch(
      `/api/invitations/${encodeURIComponent(token)}/sign-up`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      },
    );
    setMessage(
      response.ok
        ? "Si la invitacion puede procesarse, revisa tu correo para verificarlo."
        : "La invitacion no es valida o los datos no pudieron procesarse.",
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-md rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
          CRM
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Invitacion de agencia</h1>
        {email ? (
          <>
            <p className="mt-4 text-[var(--crm-muted)]">Cuenta verificada: {email}</p>
            <button
              className="mt-8 w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
              onClick={accept}
              type="button"
            >
              Aceptar invitacion
            </button>
          </>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={signup}>
            <p className="text-sm text-[var(--crm-muted)]">
              Crea una identidad solo para esta invitacion.
            </p>
            <label className="block text-sm font-medium">
              Correo
              <input
                className="mt-2 w-full rounded-lg border p-3"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium">
              Nombre
              <input
                className="mt-2 w-full rounded-lg border p-3"
                name="name"
                required
              />
            </label>
            <label className="block text-sm font-medium">
              Contrasena
              <input
                className="mt-2 w-full rounded-lg border p-3"
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button
              className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
              type="submit"
            >
              Crear y verificar cuenta
            </button>
          </form>
        )}
        {message ? (
          <p className="mt-5 text-sm text-green-700" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <a
          className="mt-6 inline-block text-sm"
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
        >
          Ya tengo cuenta
        </a>
      </section>
    </main>
  );
}
