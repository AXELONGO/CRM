"use client";

import { useState } from "react";

export function PortalMessageForm({
  tenantSlug,
  projectId,
}: {
  tenantSlug: string;
  projectId: string;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/portal/${tenantSlug}/projects/${projectId}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    setStatus(response.ok ? "Mensaje enviado." : "No se pudo enviar el mensaje.");
    if (response.ok) setBody("");
  }
  return (
    <form className="mt-6" onSubmit={submit}>
      <label className="text-sm font-medium" htmlFor="portal-message">
        Mensaje al equipo
      </label>
      <textarea
        id="portal-message"
        className="mt-2 min-h-24 w-full rounded-lg border p-3"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={5000}
        required
      />
      <button
        className="mt-3 rounded-lg bg-[var(--crm-primary)] px-4 py-2 font-medium text-white"
        type="submit"
      >
        Enviar mensaje
      </button>
      {status ? (
        <p className="mt-2 text-sm" role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
