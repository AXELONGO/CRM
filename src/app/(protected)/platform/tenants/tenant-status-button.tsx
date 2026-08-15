"use client";

import { useState } from "react";

export function TenantStatusButton({
  tenantId,
  status,
}: {
  tenantId: string;
  status: "active" | "suspended";
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (
      !window.confirm(
        status === "active" ? "Suspender esta agencia?" : "Reactivar esta agencia?",
      )
    )
      return;
    setBusy(true);
    await fetch(`/api/platform/tenants/${tenantId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: status === "active" ? "suspended" : "active" }),
    });
    window.location.reload();
  }

  return (
    <button
      className="rounded border px-3 py-1 text-xs"
      disabled={busy}
      onClick={toggle}
      type="button"
    >
      {busy ? "Guardando..." : status === "active" ? "Suspender" : "Reactivar"}
    </button>
  );
}
