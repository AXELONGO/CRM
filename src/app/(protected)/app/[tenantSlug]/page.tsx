import { can } from "@/modules/tenancy/domain/policy";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, context } = await requireServerTenant(tenantSlug, "internal");
  const actor = { userId: session.user.id, isPlatformAdministrator: false };
  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <section className="mx-auto max-w-3xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 shadow-sm sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
              CRM
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              {context.tenant.displayName}
            </h1>
          </div>
          <SignOutButton />
        </div>
        <p className="mt-8 text-[var(--crm-muted)]">Base multiempresa preparada.</p>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Contexto: {context.tenant.slug}
        </p>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Roles: {context.roles.join(", ")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/crm/contacts`}
          >
            Directorio de contactos
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/crm/accounts`}
          >
            Cuentas comerciales
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/sales`}
          >
            Pipeline de ventas
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/inbox`}
          >
            Bandeja unificada
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/payments/receivables`}
          >
            Cuentas por cobrar
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/projects`}
          >
            Proyectos
          </a>
          <a
            className="rounded-lg border px-4 py-3 font-medium"
            href={`/app/${context.tenant.slug}/content`}
          >
            Planificación editorial
          </a>
        </div>
        {can(actor, "members.view", context) ? (
          <a
            className="mt-8 inline-block rounded-lg bg-[var(--crm-primary)] px-4 py-3 font-medium text-white"
            href={`/app/${context.tenant.slug}/settings/members`}
          >
            Administrar miembros
          </a>
        ) : null}
      </section>
    </main>
  );
}
