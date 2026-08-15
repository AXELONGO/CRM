"use client";

export function ArchiveAction({
  tenantSlug,
  resource,
  id,
  version,
  status,
}: {
  tenantSlug: string;
  resource: "contacts" | "accounts";
  id: string;
  version: number;
  status: "active" | "archived";
}) {
  async function changeStatus() {
    await fetch(`/api/tenants/${tenantSlug}/crm/${resource}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version,
        status: status === "active" ? "archived" : "active",
      }),
    });
    window.location.reload();
  }
  return (
    <button
      className="rounded border px-3 py-2 text-sm"
      onClick={changeStatus}
      type="button"
    >
      {status === "active" ? "Archivar" : "Restaurar"}
    </button>
  );
}

export function NoteForm({
  tenantSlug,
  resource,
  id,
}: {
  tenantSlug: string;
  resource: "contacts" | "accounts";
  id: string;
}) {
  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form).get("body");
        await fetch(`/api/tenants/${tenantSlug}/crm/${resource}/${id}/notes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        });
        form.reset();
        window.location.reload();
      }}
    >
      <label className="grid gap-1 text-sm">
        Agregar nota interna
        <textarea
          className="rounded border p-2"
          maxLength={10000}
          name="body"
          required
          rows={3}
        />
      </label>
      <button className="w-fit rounded border px-3 py-2 text-sm" type="submit">
        Guardar nota
      </button>
    </form>
  );
}
