import { getDatabase } from "@/infrastructure/database/client";
import { listTenants } from "@/modules/tenancy/infrastructure/repositories";
import { requireServerPlatformAdministrator } from "@/modules/tenancy/infrastructure/server-context";
import { SignOutButton } from "../../app/sign-out-button";
import { TenantCreateForm } from "./tenant-create-form";
import { TenantStatusButton } from "./tenant-status-button";

export const dynamic = "force-dynamic";

export default async function PlatformTenantsPage() {
  await requireServerPlatformAdministrator();
  const tenants = await listTenants(getDatabase());
  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-5xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
              CRM Plataforma
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Agencias</h1>
          </div>
          <SignOutButton />
        </div>
        <TenantCreateForm />
        <div className="mt-10 grid gap-3">
          {tenants.length === 0 ? (
            <p className="text-[var(--crm-muted)]">No hay agencias creadas.</p>
          ) : null}
          {tenants.map((tenant) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--crm-border)] p-4"
              key={tenant.id}
            >
              <div>
                <p className="font-medium">{tenant.displayName}</p>
                <p className="text-sm text-[var(--crm-muted)]">/{tenant.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border px-3 py-1 text-xs">
                  {tenant.status}
                </span>
                <TenantStatusButton tenantId={tenant.id} status={tenant.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
