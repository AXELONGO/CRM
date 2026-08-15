import Link from "next/link";
import { ContactCreateForm } from "../contacts-client";

export default async function NewContactPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <section className="mx-auto max-w-2xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 sm:p-10">
        <Link
          className="text-sm text-[var(--crm-primary)]"
          href={`/app/${tenantSlug}/crm/contacts`}
        >
          Volver a contactos
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Nuevo contacto</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          No se crea una oportunidad ni un estado comercial.
        </p>
        <div className="mt-8">
          <ContactCreateForm tenantSlug={tenantSlug} />
        </div>
      </section>
    </main>
  );
}
