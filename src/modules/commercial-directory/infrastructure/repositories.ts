import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  accountContacts,
  accountNotes,
  accountTags,
  commercialAccounts,
  commercialAuditEvents,
  commercialContacts,
  commercialTags,
  communicationConsentEvents,
  contactMethods,
  contactNotes,
  contactTags,
  tenantMembershipRoles,
  tenantMemberships,
} from "@/infrastructure/database/schema";
import { CommercialConflictError, CommercialNotFoundError } from "../domain/errors";
import {
  decodeCursor,
  encodeCursor,
  normalizeContactMethod,
  normalizeDisplayName,
  normalizeSearchText,
} from "../domain/normalization";

type Tx = TenantTransaction;

async function assertInternalMembership(
  tx: Tx,
  tenantId: string,
  membershipId?: string | null,
) {
  if (!membershipId) return;
  const rows = await tx
    .select({
      id: tenantMemberships.id,
      status: tenantMemberships.status,
      role: tenantMembershipRoles.role,
    })
    .from(tenantMemberships)
    .innerJoin(
      tenantMembershipRoles,
      eq(tenantMembershipRoles.membershipId, tenantMemberships.id),
    )
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.id, membershipId),
      ),
    );
  if (
    !rows.length ||
    rows[0].status !== "active" ||
    rows.some((row) => row.role === "client")
  ) {
    throw new Error("OWNER_INVALID");
  }
}

async function assertContactExists(tx: Tx, tenantId: string, contactId: string) {
  const [contact] = await tx
    .select({ id: commercialContacts.id })
    .from(commercialContacts)
    .where(
      and(
        eq(commercialContacts.tenantId, tenantId),
        eq(commercialContacts.id, contactId),
      ),
    )
    .limit(1);
  if (!contact) throw new CommercialNotFoundError();
}

async function assertAccountExists(tx: Tx, tenantId: string, accountId: string) {
  const [account] = await tx
    .select({ id: commercialAccounts.id })
    .from(commercialAccounts)
    .where(
      and(
        eq(commercialAccounts.tenantId, tenantId),
        eq(commercialAccounts.id, accountId),
      ),
    )
    .limit(1);
  if (!account) throw new CommercialNotFoundError();
}

async function assertTagExists(tx: Tx, tenantId: string, tagId: string) {
  const [tag] = await tx
    .select({ id: commercialTags.id })
    .from(commercialTags)
    .where(and(eq(commercialTags.tenantId, tenantId), eq(commercialTags.id, tagId)))
    .limit(1);
  if (!tag) throw new CommercialNotFoundError();
}

async function audit(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    changedFields?: string[];
  },
) {
  await tx.insert(commercialAuditEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changedFields: input.changedFields ?? [],
  });
}

export async function findContactDuplicates(
  tx: Tx,
  input: {
    tenantId: string;
    displayName: string;
    methods?: Array<{
      type: "email" | "phone" | "whatsapp";
      value: string;
      countryCode?: string;
    }>;
  },
) {
  const normalizedName = normalizeSearchText(input.displayName);
  const normalizedMethods = (input.methods ?? []).map((method) => ({
    type: method.type,
    value: normalizeContactMethod(method.type, method.value, method.countryCode),
  }));
  const methodCondition = normalizedMethods.length
    ? sql`exists (select 1 from crm_contact_methods cm where cm.tenant_id = ${input.tenantId} and cm.contact_id = ${commercialContacts.id} and (${sql.join(
        normalizedMethods.map(
          (method) =>
            sql`(cm.type = ${method.type} and cm.normalized_value = ${method.value})`,
        ),
        sql` or `,
      )}))`
    : sql`false`;
  const candidates = await tx
    .select({
      id: commercialContacts.id,
      displayName: commercialContacts.displayName,
      displayNameNormalized: commercialContacts.displayNameNormalized,
    })
    .from(commercialContacts)
    .where(
      and(
        eq(commercialContacts.tenantId, input.tenantId),
        eq(commercialContacts.status, "active"),
        or(
          eq(commercialContacts.displayNameNormalized, normalizedName),
          methodCondition,
        ),
      ),
    )
    .limit(10);
  return candidates;
}

export async function createContact(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    membershipId?: string | null;
    displayName: string;
    givenName?: string | null;
    familyName?: string | null;
    ownerMembershipId?: string | null;
    doNotContact?: boolean;
    doNotContactReason?: string | null;
  },
) {
  const displayName = normalizeDisplayName(input.displayName);
  await assertInternalMembership(tx, input.tenantId, input.ownerMembershipId);
  const [contact] = await tx
    .insert(commercialContacts)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      displayName,
      displayNameNormalized: normalizeSearchText(displayName),
      givenName: input.givenName?.trim() || null,
      familyName: input.familyName?.trim() || null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      doNotContact: input.doNotContact ?? false,
      doNotContactReason: input.doNotContact
        ? input.doNotContactReason?.trim() || null
        : null,
      doNotContactAt: input.doNotContact ? new Date() : null,
      doNotContactByUserId: input.doNotContact ? input.actorUserId : null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "contact.created",
    entityType: "contact",
    entityId: contact.id,
  });
  return contact;
}

export async function updateContact(
  tx: Tx,
  input: {
    tenantId: string;
    contactId: string;
    actorUserId: string;
    version: number;
    displayName?: string;
    givenName?: string | null;
    familyName?: string | null;
    ownerMembershipId?: string | null;
    doNotContact?: boolean;
    doNotContactReason?: string | null;
  },
) {
  await assertInternalMembership(tx, input.tenantId, input.ownerMembershipId);
  const values = {
    ...(input.displayName === undefined
      ? {}
      : {
          displayName: normalizeDisplayName(input.displayName),
          displayNameNormalized: normalizeSearchText(input.displayName),
        }),
    ...(input.givenName === undefined
      ? {}
      : { givenName: input.givenName?.trim() || null }),
    ...(input.familyName === undefined
      ? {}
      : { familyName: input.familyName?.trim() || null }),
    ...(input.ownerMembershipId === undefined
      ? {}
      : { ownerMembershipId: input.ownerMembershipId }),
    ...(input.doNotContact === undefined
      ? {}
      : {
          doNotContact: input.doNotContact,
          doNotContactReason: input.doNotContact
            ? input.doNotContactReason?.trim() || null
            : null,
          doNotContactAt: input.doNotContact ? new Date() : null,
          doNotContactByUserId: input.doNotContact ? input.actorUserId : null,
        }),
    updatedAt: new Date(),
    updatedByUserId: input.actorUserId,
    version: sql`${commercialContacts.version} + 1`,
  };
  const [contact] = await tx
    .update(commercialContacts)
    .set(values)
    .where(
      and(
        eq(commercialContacts.tenantId, input.tenantId),
        eq(commercialContacts.id, input.contactId),
        eq(commercialContacts.version, input.version),
      ),
    )
    .returning();
  if (!contact) throw new CommercialConflictError();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "contact.updated",
    entityType: "contact",
    entityId: input.contactId,
    changedFields: Object.keys(values),
  });
  return contact;
}

export async function setContactStatus(
  tx: Tx,
  input: {
    tenantId: string;
    contactId: string;
    actorUserId: string;
    version: number;
    status: "active" | "archived";
  },
) {
  const [contact] = await tx
    .update(commercialContacts)
    .set({
      status: input.status,
      archivedAt: input.status === "archived" ? new Date() : null,
      archivedByUserId: input.status === "archived" ? input.actorUserId : null,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${commercialContacts.version} + 1`,
    })
    .where(
      and(
        eq(commercialContacts.tenantId, input.tenantId),
        eq(commercialContacts.id, input.contactId),
        eq(commercialContacts.version, input.version),
      ),
    )
    .returning();
  if (!contact) throw new CommercialConflictError();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: `contact.${input.status}`,
    entityType: "contact",
    entityId: input.contactId,
  });
  return contact;
}

export async function listContacts(
  tx: Tx,
  input: {
    tenantId: string;
    query?: string;
    status?: "active" | "archived";
    ownerMembershipId?: string;
    doNotContact?: boolean;
    limit: number;
    cursor?: string;
  },
) {
  const conditions = [eq(commercialContacts.tenantId, input.tenantId)];
  if (input.status) conditions.push(eq(commercialContacts.status, input.status));
  if (input.ownerMembershipId)
    conditions.push(eq(commercialContacts.ownerMembershipId, input.ownerMembershipId));
  if (input.doNotContact !== undefined)
    conditions.push(eq(commercialContacts.doNotContact, input.doNotContact));
  if (input.query) {
    const query = `%${normalizeSearchText(input.query)}%`;
    conditions.push(
      or(
        ilike(commercialContacts.displayNameNormalized, query),
        sql`exists (select 1 from crm_contact_methods cm where cm.tenant_id = ${input.tenantId} and cm.contact_id = ${commercialContacts.id} and cm.normalized_value like ${query})`,
      ) as (typeof conditions)[number],
    );
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    conditions.push(
      or(
        lt(commercialContacts.updatedAt, cursor.updatedAt),
        and(
          eq(commercialContacts.updatedAt, cursor.updatedAt),
          lt(commercialContacts.id, cursor.id),
        ),
      ) as (typeof conditions)[number],
    );
  }
  const rows = await tx
    .select()
    .from(commercialContacts)
    .where(and(...conditions))
    .orderBy(desc(commercialContacts.updatedAt), desc(commercialContacts.id))
    .limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  const methods = items.length
    ? await tx
        .select()
        .from(contactMethods)
        .where(
          and(
            eq(contactMethods.tenantId, input.tenantId),
            inArray(
              contactMethods.contactId,
              items.map((item) => item.id),
            ),
            eq(contactMethods.isPrimary, true),
            eq(contactMethods.status, "active"),
          ),
        )
    : [];
  return {
    items: items.map((item) => ({
      ...item,
      primaryMethod: methods.find((method) => method.contactId === item.id) ?? null,
    })),
    nextCursor:
      hasMore && items.length
        ? encodeCursor(items[items.length - 1].updatedAt, items[items.length - 1].id)
        : null,
  };
}

export async function getContact(tx: Tx, tenantId: string, contactId: string) {
  const [contact] = await tx
    .select()
    .from(commercialContacts)
    .where(
      and(
        eq(commercialContacts.tenantId, tenantId),
        eq(commercialContacts.id, contactId),
      ),
    )
    .limit(1);
  if (!contact) throw new CommercialNotFoundError();
  const [methods, accounts, notes, consentEvents] = await Promise.all([
    tx
      .select()
      .from(contactMethods)
      .where(
        and(
          eq(contactMethods.tenantId, tenantId),
          eq(contactMethods.contactId, contactId),
          eq(contactMethods.status, "active"),
        ),
      )
      .orderBy(desc(contactMethods.isPrimary), asc(contactMethods.type)),
    tx
      .select({ relation: accountContacts, account: commercialAccounts })
      .from(accountContacts)
      .innerJoin(
        commercialAccounts,
        and(
          eq(commercialAccounts.tenantId, tenantId),
          eq(commercialAccounts.id, accountContacts.accountId),
        ),
      )
      .where(
        and(
          eq(accountContacts.tenantId, tenantId),
          eq(accountContacts.contactId, contactId),
        ),
      ),
    tx
      .select()
      .from(contactNotes)
      .where(
        and(eq(contactNotes.tenantId, tenantId), eq(contactNotes.contactId, contactId)),
      )
      .orderBy(desc(contactNotes.createdAt)),
    tx
      .select()
      .from(communicationConsentEvents)
      .where(
        and(
          eq(communicationConsentEvents.tenantId, tenantId),
          eq(communicationConsentEvents.contactId, contactId),
        ),
      )
      .orderBy(desc(communicationConsentEvents.occurredAt)),
  ]);
  return { contact, methods, accounts, notes, consentEvents };
}

export async function addContactMethod(
  tx: Tx,
  input: {
    tenantId: string;
    contactId: string;
    actorUserId: string;
    type: "email" | "phone" | "whatsapp";
    label: "work" | "personal" | "other";
    value: string;
    countryCode?: string;
    isPrimary?: boolean;
  },
) {
  await assertContactExists(tx, input.tenantId, input.contactId);
  const normalizedValue = normalizeContactMethod(
    input.type,
    input.value,
    input.countryCode,
  );
  if (input.isPrimary)
    await tx
      .update(contactMethods)
      .set({
        isPrimary: false,
        updatedAt: new Date(),
        updatedByUserId: input.actorUserId,
      })
      .where(
        and(
          eq(contactMethods.tenantId, input.tenantId),
          eq(contactMethods.contactId, input.contactId),
          eq(contactMethods.type, input.type),
          eq(contactMethods.status, "active"),
        ),
      );
  const [method] = await tx
    .insert(contactMethods)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      contactId: input.contactId,
      type: input.type,
      label: input.label,
      originalValue: input.value.trim(),
      normalizedValue,
      isPrimary: input.isPrimary ?? false,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "contact_method.created",
    entityType: "contact_method",
    entityId: method.id,
  });
  return method;
}

export async function relateContactToAccount(
  tx: Tx,
  input: {
    tenantId: string;
    contactId: string;
    accountId: string;
    actorUserId: string;
    title?: string;
    department?: string;
    relationshipType?:
      "decision_maker" | "billing" | "technical" | "employee" | "other";
    isPrimaryContact?: boolean;
  },
) {
  await assertContactExists(tx, input.tenantId, input.contactId);
  await assertAccountExists(tx, input.tenantId, input.accountId);
  if (input.isPrimaryContact)
    await tx
      .update(accountContacts)
      .set({ isPrimaryContact: false })
      .where(
        and(
          eq(accountContacts.tenantId, input.tenantId),
          eq(accountContacts.accountId, input.accountId),
        ),
      );
  await tx
    .insert(accountContacts)
    .values({
      tenantId: input.tenantId,
      contactId: input.contactId,
      accountId: input.accountId,
      title: input.title?.trim() || null,
      department: input.department?.trim() || null,
      relationshipType: input.relationshipType ?? "other",
      isPrimaryContact: input.isPrimaryContact ?? false,
      createdByUserId: input.actorUserId,
    })
    .onConflictDoNothing();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "contact_account.created",
    entityType: "contact_account",
    entityId: `${input.contactId}:${input.accountId}`,
  });
}

export async function createAccount(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    displayName: string;
    legalName?: string | null;
    website?: string | null;
    industry?: string | null;
    ownerMembershipId?: string | null;
  },
) {
  const displayName = normalizeDisplayName(input.displayName);
  await assertInternalMembership(tx, input.tenantId, input.ownerMembershipId);
  const [account] = await tx
    .insert(commercialAccounts)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      displayName,
      displayNameNormalized: normalizeSearchText(displayName),
      legalName: input.legalName?.trim() || null,
      website: input.website?.trim() || null,
      industry: input.industry?.trim() || null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "account.created",
    entityType: "account",
    entityId: account.id,
  });
  return account;
}

export async function listAccounts(
  tx: Tx,
  input: {
    tenantId: string;
    query?: string;
    status?: "active" | "archived";
    ownerMembershipId?: string;
    limit: number;
    cursor?: string;
  },
) {
  const conditions = [eq(commercialAccounts.tenantId, input.tenantId)];
  if (input.status) conditions.push(eq(commercialAccounts.status, input.status));
  if (input.ownerMembershipId)
    conditions.push(eq(commercialAccounts.ownerMembershipId, input.ownerMembershipId));
  if (input.query) {
    const query = `%${normalizeSearchText(input.query)}%`;
    conditions.push(
      or(
        ilike(commercialAccounts.displayNameNormalized, query),
        ilike(commercialAccounts.legalName, query),
        ilike(commercialAccounts.website, query),
      ) as (typeof conditions)[number],
    );
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    conditions.push(
      or(
        lt(commercialAccounts.updatedAt, cursor.updatedAt),
        and(
          eq(commercialAccounts.updatedAt, cursor.updatedAt),
          lt(commercialAccounts.id, cursor.id),
        ),
      ) as (typeof conditions)[number],
    );
  }
  const rows = await tx
    .select()
    .from(commercialAccounts)
    .where(and(...conditions))
    .orderBy(desc(commercialAccounts.updatedAt), desc(commercialAccounts.id))
    .limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  return {
    items,
    nextCursor:
      hasMore && items.length
        ? encodeCursor(items[items.length - 1].updatedAt, items[items.length - 1].id)
        : null,
  };
}

export async function updateAccount(
  tx: Tx,
  input: {
    tenantId: string;
    accountId: string;
    actorUserId: string;
    version: number;
    displayName?: string;
    legalName?: string | null;
    website?: string | null;
    industry?: string | null;
    ownerMembershipId?: string | null;
  },
) {
  await assertInternalMembership(tx, input.tenantId, input.ownerMembershipId);
  const values = {
    ...(input.displayName === undefined
      ? {}
      : {
          displayName: normalizeDisplayName(input.displayName),
          displayNameNormalized: normalizeSearchText(input.displayName),
        }),
    ...(input.legalName === undefined
      ? {}
      : { legalName: input.legalName?.trim() || null }),
    ...(input.website === undefined ? {} : { website: input.website?.trim() || null }),
    ...(input.industry === undefined
      ? {}
      : { industry: input.industry?.trim() || null }),
    ...(input.ownerMembershipId === undefined
      ? {}
      : { ownerMembershipId: input.ownerMembershipId }),
    updatedAt: new Date(),
    updatedByUserId: input.actorUserId,
    version: sql`${commercialAccounts.version} + 1`,
  };
  const [account] = await tx
    .update(commercialAccounts)
    .set(values)
    .where(
      and(
        eq(commercialAccounts.tenantId, input.tenantId),
        eq(commercialAccounts.id, input.accountId),
        eq(commercialAccounts.version, input.version),
      ),
    )
    .returning();
  if (!account) throw new CommercialConflictError();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "account.updated",
    entityType: "account",
    entityId: input.accountId,
    changedFields: Object.keys(values),
  });
  return account;
}

export async function getAccount(tx: Tx, tenantId: string, accountId: string) {
  const [account] = await tx
    .select()
    .from(commercialAccounts)
    .where(
      and(
        eq(commercialAccounts.tenantId, tenantId),
        eq(commercialAccounts.id, accountId),
      ),
    )
    .limit(1);
  if (!account) throw new CommercialNotFoundError();
  const [contacts, notes] = await Promise.all([
    tx
      .select({ relation: accountContacts, contact: commercialContacts })
      .from(accountContacts)
      .innerJoin(
        commercialContacts,
        and(
          eq(commercialContacts.tenantId, tenantId),
          eq(commercialContacts.id, accountContacts.contactId),
        ),
      )
      .where(
        and(
          eq(accountContacts.tenantId, tenantId),
          eq(accountContacts.accountId, accountId),
        ),
      ),
    tx
      .select()
      .from(accountNotes)
      .where(
        and(eq(accountNotes.tenantId, tenantId), eq(accountNotes.accountId, accountId)),
      )
      .orderBy(desc(accountNotes.createdAt)),
  ]);
  return { account, contacts, notes };
}

export async function setAccountStatus(
  tx: Tx,
  input: {
    tenantId: string;
    accountId: string;
    actorUserId: string;
    version: number;
    status: "active" | "archived";
  },
) {
  const [account] = await tx
    .update(commercialAccounts)
    .set({
      status: input.status,
      archivedAt: input.status === "archived" ? new Date() : null,
      archivedByUserId: input.status === "archived" ? input.actorUserId : null,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
      version: sql`${commercialAccounts.version} + 1`,
    })
    .where(
      and(
        eq(commercialAccounts.tenantId, input.tenantId),
        eq(commercialAccounts.id, input.accountId),
        eq(commercialAccounts.version, input.version),
      ),
    )
    .returning();
  if (!account) throw new CommercialConflictError();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: `account.${input.status}`,
    entityType: "account",
    entityId: input.accountId,
  });
  return account;
}

export async function addNote(
  tx: Tx,
  input: {
    tenantId: string;
    entity: "contact" | "account";
    entityId: string;
    authorMembershipId: string;
    actorUserId: string;
    body: string;
  },
) {
  const body = input.body.trim();
  if (!body || body.length > 10000) throw new Error("NOTE_INVALID");
  await assertInternalMembership(tx, input.tenantId, input.authorMembershipId);
  if (input.entity === "contact") {
    await assertContactExists(tx, input.tenantId, input.entityId);
  } else {
    await assertAccountExists(tx, input.tenantId, input.entityId);
  }
  const id = crypto.randomUUID();
  if (input.entity === "contact")
    await tx.insert(contactNotes).values({
      id,
      tenantId: input.tenantId,
      contactId: input.entityId,
      authorMembershipId: input.authorMembershipId,
      body,
    });
  else
    await tx.insert(accountNotes).values({
      id,
      tenantId: input.tenantId,
      accountId: input.entityId,
      authorMembershipId: input.authorMembershipId,
      body,
    });
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: `${input.entity}_note.created`,
    entityType: `${input.entity}_note`,
    entityId: id,
  });
  return id;
}

export async function createTag(
  tx: Tx,
  input: { tenantId: string; actorUserId: string; name: string; color?: string | null },
) {
  const name = normalizeDisplayName(input.name);
  const [tag] = await tx
    .insert(commercialTags)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name,
      nameNormalized: normalizeSearchText(name),
      color: input.color ?? null,
      createdByUserId: input.actorUserId,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "tag.created",
    entityType: "tag",
    entityId: tag.id,
  });
  return tag;
}

export async function assignTag(
  tx: Tx,
  input: {
    tenantId: string;
    actorUserId: string;
    entity: "contact" | "account";
    entityId: string;
    tagId: string;
  },
) {
  await assertTagExists(tx, input.tenantId, input.tagId);
  if (input.entity === "contact") {
    await assertContactExists(tx, input.tenantId, input.entityId);
  } else {
    await assertAccountExists(tx, input.tenantId, input.entityId);
  }
  if (input.entity === "contact")
    await tx
      .insert(contactTags)
      .values({
        tenantId: input.tenantId,
        contactId: input.entityId,
        tagId: input.tagId,
        createdByUserId: input.actorUserId,
      })
      .onConflictDoNothing();
  else
    await tx
      .insert(accountTags)
      .values({
        tenantId: input.tenantId,
        accountId: input.entityId,
        tagId: input.tagId,
        createdByUserId: input.actorUserId,
      })
      .onConflictDoNothing();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "tag.assigned",
    entityType: input.entity,
    entityId: input.entityId,
  });
}

export async function recordConsent(
  tx: Tx,
  input: {
    tenantId: string;
    contactId: string;
    actorUserId: string;
    channel: "email" | "phone" | "whatsapp";
    purpose: "service" | "marketing";
    status: "granted" | "denied" | "revoked";
    source: "manual" | "form" | "import" | "provider";
    occurredAt: Date;
    evidenceReference?: string | null;
  },
) {
  await assertContactExists(tx, input.tenantId, input.contactId);
  const [event] = await tx
    .insert(communicationConsentEvents)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      contactId: input.contactId,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      source: input.source,
      occurredAt: input.occurredAt,
      recordedByUserId: input.actorUserId,
      evidenceReference: input.evidenceReference?.trim() || null,
    })
    .returning();
  await audit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "communication_consent.recorded",
    entityType: "contact",
    entityId: input.contactId,
  });
  return event;
}
