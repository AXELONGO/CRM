import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getAccount } from "@/modules/commercial-directory/infrastructure/repositories";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { ArchiveAction, NoteForm } from "../../contact-actions";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; accountId: string }>;
}) {
  const { tenantSlug, accountId } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const data = await withTenantDatabase(getDatabase(), context, (tx) =>
    getAccount(tx, context.tenant.id, accountId),
  );
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <section className="mx-auto max-w-4xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/crm/accounts`}
        >
          Volver a cuentas
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{data.account.displayName}</h1>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              {data.account.website ?? "Sin sitio web"} · {data.account.status}
            </p>
          </div>
          <ArchiveAction
            id={accountId}
            resource="accounts"
            status={data.account.status}
            tenantSlug={tenantSlug}
            version={data.account.version}
          />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded border p-4">
            <h2 className="font-semibold">Contactos relacionados</h2>
            {data.contacts.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {data.contacts.map(({ contact, relation }) => (
                  <li key={contact.id}>
                    {contact.displayName}
                    {relation.isPrimaryContact ? " · principal" : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--crm-muted)]">Sin contactos.</p>
            )}
          </article>
          <article className="rounded border p-4">
            <h2 className="font-semibold">Notas internas</h2>
            {data.notes.length ? (
              <ul className="mt-3 grid gap-3 text-sm">
                {data.notes.map((note) => (
                  <li className="border-b pb-2" key={note.id}>
                    {note.body}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--crm-muted)]">Sin notas.</p>
            )}
            <NoteForm id={accountId} resource="accounts" tenantSlug={tenantSlug} />
          </article>
        </div>
      </section>
    </main>
  );
}
