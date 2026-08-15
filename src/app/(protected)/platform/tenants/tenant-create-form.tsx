"use client";

import { FormEvent, useState } from "react";

export function TenantCreateForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch("/api/platform/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    if (!response.ok) {
      setError("No se pudo crear la agencia.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Agencia creada. Se envio una invitacion al primer administrador.");
  }

  return (
    <form
      className="mt-8 grid gap-4 rounded-lg border border-[var(--crm-border)] p-5 sm:grid-cols-2"
      onSubmit={submit}
    >
      <h2 className="text-lg font-semibold sm:col-span-2">Crear agencia</h2>
      <label className="text-sm font-medium">
        Nombre visible
        <input
          className="mt-2 w-full rounded-lg border p-3"
          name="displayName"
          required
        />
      </label>
      <label className="text-sm font-medium">
        Slug
        <input
          className="mt-2 w-full rounded-lg border p-3"
          name="slug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label className="text-sm font-medium">
        Correo del primer admin
        <input
          className="mt-2 w-full rounded-lg border p-3"
          name="adminEmail"
          type="email"
          required
        />
      </label>
      <label className="text-sm font-medium">
        Zona horaria
        <input
          className="mt-2 w-full rounded-lg border p-3"
          defaultValue="America/Tijuana"
          name="timezone"
          required
        />
      </label>
      <label className="text-sm font-medium">
        Locale
        <input
          className="mt-2 w-full rounded-lg border p-3"
          defaultValue="es-MX"
          name="locale"
          required
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      ) : null}
      <button
        className="rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white sm:col-span-2"
        type="submit"
      >
        Crear agencia
      </button>
    </form>
  );
}
