import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { commercialTags } from "@/infrastructure/database/schema";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TagsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const tags = await withTenantDatabase(getDatabase(), context, (tx) =>
    tx
      .select()
      .from(commercialTags)
      .where(
        and(
          eq(commercialTags.tenantId, context.tenant.id),
          eq(commercialTags.status, "active"),
        ),
      )
      .orderBy(asc(commercialTags.name)),
  );
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <section className="mx-auto max-w-3xl rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          CRM
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Etiquetas</h1>
        <ul className="mt-8 grid gap-3">
          {tags.map((tag) => (
            <li className="rounded border p-3" key={tag.id}>
              {tag.name}
              {tag.color ? <span className="ml-2 text-xs">{tag.color}</span> : null}
            </li>
          ))}
        </ul>
        {tags.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--crm-muted)]">
            No hay etiquetas activas.
          </p>
        ) : null}
      </section>
    </main>
  );
}
