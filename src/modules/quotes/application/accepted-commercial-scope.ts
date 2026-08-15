import { and, eq, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import { quoteVersions, quotes } from "@/infrastructure/database/schema";
import { sha256Canonical } from "@/modules/agreements/domain/canonical";

export async function getAcceptedCommercialScope(
  tx: TenantTransaction,
  input: { tenantId: string; quoteId: string },
) {
  const [row] = await tx
    .select({ quote: quotes, version: quoteVersions })
    .from(quotes)
    .innerJoin(
      quoteVersions,
      and(
        eq(quoteVersions.tenantId, quotes.tenantId),
        eq(quoteVersions.quoteId, quotes.id),
      ),
    )
    .where(
      and(
        eq(quotes.tenantId, input.tenantId),
        eq(quotes.id, input.quoteId),
        eq(quotes.status, "accepted"),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!row || row.version.snapshotHash !== sha256Canonical(row.version.snapshot)) {
    throw new Error("ACCEPTED_COMMERCIAL_SCOPE_INVALID");
  }
  return {
    quoteId: row.quote.id,
    quoteVersionId: row.version.id,
    quoteNumber: row.quote.number,
    quoteVersion: row.version.versionNumber,
    quoteHash: row.version.snapshotHash,
    currency: row.quote.currency,
    snapshot: row.version.snapshot,
    acceptedAt: row.quote.updatedAt,
  };
}
