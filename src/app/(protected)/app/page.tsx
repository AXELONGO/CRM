import { redirect } from "next/navigation";
import { getDatabase } from "@/infrastructure/database/client";
import { listUserMemberships } from "@/modules/tenancy/infrastructure/repositories";
import {
  requirePrivilegedMfa,
  requireServerIdentity,
} from "@/modules/tenancy/infrastructure/server-context";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function ProtectedAppPage() {
  const session = await requireServerIdentity();
  await requirePrivilegedMfa(session.user.id);
  const memberships = await listUserMemberships(getDatabase(), session.user.id);
  const usable = memberships.filter(
    (membership) =>
      membership.membershipStatus === "active" && membership.tenantStatus === "active",
  );
  const internal = usable.filter((membership) => !membership.roles.includes("client"));
  const portal = usable.filter((membership) => membership.roles.includes("client"));

  if (internal.length === 1 && portal.length === 0)
    redirect(`/app/${internal[0].slug}`);
  if (internal.length === 0 && portal.length === 1)
    redirect(`/portal/${portal[0].slug}`);

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-3xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
              CRM
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Sesion autenticada</h1>
          </div>
          <SignOutButton />
        </div>
        <p className="mt-8 text-[var(--crm-muted)]">
          Autenticado como {session.user.name}.
        </p>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">{session.user.email}</p>
        {usable.length === 0 ? (
          <div className="mt-8 rounded-lg border border-[var(--crm-border)] p-5">
            <h2 className="font-semibold">Sin acceso asignado</h2>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              Tu identidad esta verificada, pero aun no tienes una agencia activa.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            <h2 className="font-semibold">Selecciona una agencia</h2>
            {usable.map((membership) => (
              <a
                className="rounded-lg border border-[var(--crm-border)] p-4 hover:bg-slate-50"
                href={`${membership.roles.includes("client") ? "/portal" : "/app"}/${membership.slug}`}
                key={membership.membershipId}
              >
                <span className="block font-medium">{membership.displayName}</span>
                <span className="mt-1 block text-sm text-[var(--crm-muted)]">
                  {membership.roles.join(", ")}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
