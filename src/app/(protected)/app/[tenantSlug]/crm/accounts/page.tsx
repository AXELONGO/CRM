import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { listAccounts } from "@/modules/commercial-directory/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { AccountCreateForm } from "./accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const result = await withTenantDatabase(getDatabase(), context, (tx) =>
    listAccounts(tx, { tenantId: context.tenant.id, query: query.q, limit: 25 }),
  );
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <section className="mx-auto max-w-5xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              className="text-sm text-[var(--crm-primary)]"
              href={`/app/${tenantSlug}`}
            >
              CRM
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Cuentas comerciales</h1>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              Empresas y organizaciones, separadas del tenant y del pipeline.
            </p>
          </div>
          <Link
            className="rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white"
            href={`/app/${tenantSlug}/crm/accounts/new`}
          >
            Agregar cuenta
          </Link>
        </div>
        <form className="mt-8 flex gap-2" method="get">
          <input
            className="min-w-0 flex-1 rounded border p-2"
            defaultValue={query.q}
            name="q"
            placeholder="Buscar cuenta"
          />
          <button className="rounded border px-4 py-2" type="submit">
            Buscar
          </button>
        </form>
        <AccountCreateForm tenantSlug={tenantSlug} />
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Nombre</th>
                <th className="p-3">Sitio web</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((account) => (
                <tr className="border-b" key={account.id}>
                  <td className="p-3">
                    <Link
                      className="font-medium underline"
                      href={`/app/${tenantSlug}/crm/accounts/${account.id}`}
                    >
                      {account.displayName}
                    </Link>
                  </td>
                  <td className="p-3">{account.website ?? "Sin sitio"}</td>
                  <td className="p-3">{account.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.items.length === 0 ? (
            <p className="p-4 text-sm text-[var(--crm-muted)]">
              No hay cuentas con esos criterios.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
