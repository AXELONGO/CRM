import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { listConversations } from "@/modules/inbox/infrastructure/repositories";
import { InboxClient } from "./inbox-client";
export const dynamic = "force-dynamic";
export default async function InboxPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const conversations = await withTenantDatabase(getDatabase(), context, (tx) =>
    listConversations(tx, { tenantId: context.tenant.id }),
  );
  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <section className="mx-auto max-w-[1400px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 shadow-sm sm:p-8">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          CRM
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Bandeja</h1>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Conversaciones del tenant. Las notas internas nunca se envían al proveedor.
        </p>
        <InboxClient tenantSlug={tenantSlug} initialConversations={conversations} />
      </section>
    </main>
  );
}
