"use client";

import { useState } from "react";

export function ContactCreateForm({ tenantSlug }: { tenantSlug: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    const data = new FormData(form);
    const response = await fetch(`/api/tenants/${tenantSlug}/crm/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: data.get("displayName"),
        methods: data.get("email")
          ? [
              {
                type: "email",
                value: data.get("email"),
                label: "work",
                isPrimary: true,
              },
            ]
          : [],
      }),
    });
    const body = (await response.json()) as { warning?: string; error?: string };
    setMessage(
      response.ok
        ? "Contacto creado."
        : (body.warning ?? body.error ?? "No se pudo guardar."),
    );
    setBusy(false);
    if (response.ok) form.reset();
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-[var(--crm-border)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <label className="grid gap-1 text-sm">
        Nombre visible
        <input
          className="rounded border p-2"
          name="displayName"
          required
          minLength={2}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Correo de trabajo
        <input className="rounded border p-2" name="email" type="email" />
      </label>
      <button
        className="w-fit rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white"
        disabled={busy}
        type="submit"
      >
        {busy ? "Guardando..." : "Nuevo contacto"}
      </button>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
