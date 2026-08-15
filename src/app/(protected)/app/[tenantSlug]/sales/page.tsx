import Link from "next/link";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { requireServerTenant } from "@/modules/tenancy/infrastructure/server-context";
import {
  getPipelineBoard,
  listPipelines,
} from "@/modules/sales/infrastructure/repositories";
import { SalesBoard } from "./sales-board";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const { context } = await requireServerTenant(tenantSlug, "internal");
  const db = getDatabase();
  const pipelines = await withTenantDatabase(db, context, (tx) =>
    listPipelines(tx, context.tenant.id),
  );
  const pipelineId =
    query.pipeline ??
    pipelines.find((pipeline) => pipeline.isDefault)?.id ??
    pipelines[0]?.id;
  const board = pipelineId
    ? await withTenantDatabase(db, context, (tx) =>
        getPipelineBoard(tx, { tenantId: context.tenant.id, pipelineId }),
      )
    : null;
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-[1400px] rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-sm sm:p-10">
        <Link className="text-sm text-[var(--crm-primary)]" href={`/app/${tenantSlug}`}>
          CRM
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Oportunidades</h1>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              Pipeline comercial por etapa, responsable y siguiente actividad.
            </p>
          </div>
          <Link
            className="rounded bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white"
            href={`/app/${tenantSlug}/sales/forecast`}
          >
            Ver forecast
          </Link>
        </div>
        {pipelines.length ? (
          <SalesBoard
            tenantSlug={tenantSlug}
            pipelines={pipelines}
            selectedPipelineId={pipelineId}
            board={board}
            membershipId={context.membership.id}
          />
        ) : (
          <p className="mt-10 rounded border border-dashed p-8 text-center text-sm text-[var(--crm-muted)]">
            No hay pipelines. Usa el comando de aprovisionamiento o crea uno desde la
            API.
          </p>
        )}
      </section>
    </main>
  );
}
