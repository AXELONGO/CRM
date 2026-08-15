import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { getContact } from "@/modules/commercial-directory/infrastructure/repositories";
import { ArchiveAction, NoteForm } from "../../contact-actions";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; contactId: string }>;
}) {
  const { tenantSlug, contactId } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const data = await withTenantDatabase(getDatabase(), context, (tx) =>
    getContact(tx, context.tenant.id, contactId),
  );
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <section className="mx-auto max-w-4xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/crm/contacts`}
        >
          Volver a contactos
        </Link>
        <div className="mt-4 flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{data.contact.displayName}</h1>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              {data.contact.status} ·{" "}
              {data.contact.doNotContact ? "No contactar" : "Preferencia no definida"}
            </p>
          </div>
          <ArchiveAction
            id={contactId}
            resource="contacts"
            status={data.contact.status}
            tenantSlug={tenantSlug}
            version={data.contact.version}
          />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded border p-4">
            <h2 className="font-semibold">Métodos</h2>
            {data.methods.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {data.methods.map((method) => (
                  <li key={method.id}>
                    {method.type}: {method.originalValue}
                    {method.isPrimary ? " · principal" : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--crm-muted)]">Sin métodos.</p>
            )}
          </article>
          <article className="rounded border p-4">
            <h2 className="font-semibold">Cuentas relacionadas</h2>
            {data.accounts.length ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {data.accounts.map(({ account }) => (
                  <li key={account.id}>{account.displayName}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--crm-muted)]">
                Sin cuenta comercial.
              </p>
            )}
          </article>
          <article className="rounded border p-4 md:col-span-2">
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
              <p className="mt-3 text-sm text-[var(--crm-muted)]">
                Sin notas internas.
              </p>
            )}
            <NoteForm id={contactId} resource="contacts" tenantSlug={tenantSlug} />
          </article>
        </div>
      </section>
    </main>
  );
}
