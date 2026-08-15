"use client";

import { useState } from "react";

export function AccountCreateForm({ tenantSlug }: { tenantSlug: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-lg border border-[var(--crm-border)] p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const data = new FormData(event.currentTarget);
        const response = await fetch(`/api/tenants/${tenantSlug}/crm/accounts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: data.get("displayName"),
            website: data.get("website") || null,
          }),
        });
        setMessage(response.ok ? "Cuenta creada." : "No se pudo guardar.");
        setBusy(false);
        if (response.ok) event.currentTarget.reset();
      }}
    >
      <label className="grid gap-1 text-sm">
        Nombre comercial
        <input
          className="rounded border p-2"
          name="displayName"
          required
          minLength={2}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Sitio web
        <input className="rounded border p-2" name="website" type="url" />
      </label>
      <button
        className="w-fit rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white"
        disabled={busy}
        type="submit"
      >
        {busy ? "Guardando..." : "Nueva cuenta"}
      </button>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
