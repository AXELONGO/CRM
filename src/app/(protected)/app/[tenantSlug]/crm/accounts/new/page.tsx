import Link from "next/link";
import { AccountCreateForm } from "../accounts-client";

export default async function NewAccountPage({
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
          href={`/app/${tenantSlug}/crm/accounts`}
        >
          Volver a cuentas
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Nueva cuenta comercial</h1>
        <div className="mt-8">
          <AccountCreateForm tenantSlug={tenantSlug} />
        </div>
      </section>
    </main>
  );
}
