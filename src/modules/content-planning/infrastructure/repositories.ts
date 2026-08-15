import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  contentIdeas,
  contentItems,
  contentNotes,
  contentOutboxEvents,
  contentReviews,
  contentVariants,
  editorialBrands,
} from "@/infrastructure/database/schema";
import {
  assertContentTransition,
  assertPlannedDate,
  type ContentState,
} from "../domain/state";

async function outbox(
  tx: TenantTransaction,
  tenantId: string,
  name: string,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  await tx
    .insert(contentOutboxEvents)
    .values({ id: crypto.randomUUID(), tenantId, name, aggregateId, payload });
}

export async function listContent(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(contentItems)
    .where(eq(contentItems.tenantId, tenantId))
    .orderBy(asc(contentItems.plannedDate), desc(contentItems.updatedAt));
}
export async function listIdeas(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(contentIdeas)
    .where(eq(contentIdeas.tenantId, tenantId))
    .orderBy(desc(contentIdeas.priority), desc(contentIdeas.createdAt));
}
export async function listNotes(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(contentNotes)
    .where(
      and(eq(contentNotes.tenantId, tenantId), sql`${contentNotes.archivedAt} is null`),
    )
    .orderBy(desc(contentNotes.createdAt));
}

export async function createBrand(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    name: string;
    slug: string;
    accountId?: string;
  },
) {
  const [brand] = await tx
    .insert(editorialBrands)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      brandType: input.accountId ? "client_owned" : "agency_owned",
      accountId: input.accountId,
      createdByMembershipId: input.membershipId,
    })
    .returning();
  return brand;
}
export async function createIdea(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    title: string;
    body?: string;
    brandId?: string;
    accountId?: string;
  },
) {
  const [idea] = await tx
    .insert(contentIdeas)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      createdByMembershipId: input.membershipId,
      title: input.title.trim(),
      body: input.body?.trim(),
      brandId: input.brandId,
      accountId: input.accountId,
    })
    .returning();
  return idea;
}
export async function createNote(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    title: string;
    body: string;
    accountId?: string;
  },
) {
  const [note] = await tx
    .insert(contentNotes)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      createdByMembershipId: input.membershipId,
      title: input.title.trim(),
      body: input.body.trim(),
      accountId: input.accountId,
    })
    .returning();
  return note;
}
export async function createContent(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    brandId: string;
    title: string;
    plannedDate?: string;
    timezone: string;
    sourceIdeaId?: string;
    sourceNoteId?: string;
  },
) {
  if (input.plannedDate) assertPlannedDate(input.plannedDate, input.timezone);
  const [item] = await tx
    .insert(contentItems)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      createdByMembershipId: input.membershipId,
      brandId: input.brandId,
      title: input.title.trim(),
      plannedDate: input.plannedDate,
      timezone: input.timezone,
      sourceIdeaId: input.sourceIdeaId,
      sourceNoteId: input.sourceNoteId,
    })
    .returning();
  if (input.sourceIdeaId)
    await tx
      .update(contentIdeas)
      .set({ status: "converted" })
      .where(
        and(
          eq(contentIdeas.tenantId, input.tenantId),
          eq(contentIdeas.id, input.sourceIdeaId),
        ),
      );
  await outbox(tx, input.tenantId, "ContentItemCreated.v1", item.id, {
    contentItemId: item.id,
  });
  return item;
}
export async function createVariant(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    contentItemId: string;
    channel:
      | "instagram"
      | "facebook"
      | "linkedin"
      | "tiktok"
      | "youtube"
      | "blog"
      | "email"
      | "other";
    format: string;
    copyText?: string;
  },
) {
  const [variant] = await tx
    .insert(contentVariants)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      contentItemId: input.contentItemId,
      channel: input.channel,
      format: input.format.trim(),
      copyText: input.copyText?.trim(),
    })
    .returning();
  return variant;
}
export async function transitionContent(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    contentItemId: string;
    from: ContentState;
    to: ContentState;
    membershipId: string;
    version: number;
    comment?: string;
  },
) {
  assertContentTransition(input.from, input.to);
  const [item] = await tx
    .update(contentItems)
    .set({
      state: input.to,
      version: sql`${contentItems.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contentItems.tenantId, input.tenantId),
        eq(contentItems.id, input.contentItemId),
        eq(contentItems.state, input.from),
        eq(contentItems.version, input.version),
      ),
    )
    .returning();
  if (!item) throw new Error("CONTENT_CONFLICT");
  await tx.insert(contentReviews).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    contentItemId: item.id,
    reviewerMembershipId: input.membershipId,
    decision: input.to === "changes_requested" ? "changes_requested" : "approved",
    comment: input.comment,
    version: input.version,
  });
  await outbox(tx, input.tenantId, "ContentStateChanged.v1", item.id, {
    contentItemId: item.id,
    state: input.to,
  });
  return item;
}
