"use client";

import { useState, type FormEvent } from "react";

const roles = ["tenant_admin", "sales", "execution", "finance", "client"] as const;

type Member = {
  membershipId: string;
  email: string;
  name: string;
  status: string;
  role: (typeof roles)[number];
};
type Invitation = {
  id: string;
  email: string;
  status: string;
  role: (typeof roles)[number];
};

export function MembersClient({
  tenantSlug,
  members,
  invitations,
  canManage,
}: {
  tenantSlug: string;
  members: Member[];
  invitations: Invitation[];
  canManage: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/tenants/${tenantSlug}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), roles: [form.get("role")] }),
    });
    setMessage(response.ok ? "Invitacion enviada." : "No se pudo crear la invitacion.");
  }

  async function setStatus(
    membershipId: string,
    status: "active" | "suspended" | "revoked",
  ) {
    const response = await fetch(
      `/api/tenants/${tenantSlug}/members/${membershipId}/status`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    setMessage(
      response.ok ? "Estado actualizado." : "No se pudo actualizar el estado.",
    );
  }

  return (
    <section className="mt-8 grid gap-8">
      <a className="text-sm" href={`/app/${tenantSlug}`}>
        Volver a la agencia
      </a>
      {canManage ? (
        <form
          className="grid gap-4 rounded-lg border border-[var(--crm-border)] p-5 sm:grid-cols-3"
          onSubmit={invite}
        >
          <h2 className="font-semibold sm:col-span-3">Invitar miembro</h2>
          <label className="text-sm font-medium">
            Correo
            <input
              className="mt-2 w-full rounded-lg border p-3"
              name="email"
              type="email"
              required
            />
          </label>
          <label className="text-sm font-medium">
            Rol
            <select
              className="mt-2 w-full rounded-lg border p-3"
              defaultValue="sales"
              name="role"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
            type="submit"
          >
            Invitar
          </button>
        </form>
      ) : null}
      <p aria-live="polite" className="text-sm" role="status">
        {message}
      </p>
      <div>
        <h2 className="text-lg font-semibold">Miembros</h2>
        <div className="mt-3 grid gap-3">
          {members.map((member) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--crm-border)] p-4"
              key={member.membershipId}
            >
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-[var(--crm-muted)]">
                  {member.email} · {member.role}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => setStatus(member.membershipId, "suspended")}
                    type="button"
                  >
                    Suspender
                  </button>
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => setStatus(member.membershipId, "active")}
                    type="button"
                  >
                    Reactivar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Invitaciones</h2>
        <div className="mt-3 grid gap-3">
          {invitations.map((invitation) => (
            <div
              className="rounded-lg border border-[var(--crm-border)] p-4 text-sm"
              key={invitation.id}
            >
              {invitation.email} · {invitation.role} · {invitation.status}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
