import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getDatabase } from "@/infrastructure/database/client";
import {
  getCommercialAuthorization,
  authorizationError,
} from "@/modules/commercial-directory/application/authorization";
import {
  addContactMethod,
  createContact,
  findContactDuplicates,
  listContacts,
} from "@/modules/commercial-directory/infrastructure/repositories";
import { maskContactValue } from "@/modules/commercial-directory/domain/normalization";

const methodSchema = z.object({
  type: z.enum(["email", "phone", "whatsapp"]),
  value: z.string().trim().min(3).max(320),
  countryCode: z.string().optional(),
  label: z.enum(["work", "personal", "other"]).default("other"),
  isPrimary: z.boolean().default(false),
});
const contactSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  givenName: z.string().max(160).nullable().optional(),
  familyName: z.string().max(160).nullable().optional(),
  ownerMembershipId: z.string().nullable().optional(),
  doNotContact: z.boolean().default(false),
  doNotContactReason: z.string().max(500).nullable().optional(),
  methods: z.array(methodSchema).max(20).default([]),
  duplicateConfirmed: z.boolean().default(false),
});

function queryInput(request: Request) {
  const url = new URL(request.url);
  return {
    query: z
      .string()
      .max(120)
      .optional()
      .parse(url.searchParams.get("q") || undefined),
    status: z
      .enum(["active", "archived"])
      .optional()
      .parse(url.searchParams.get("status") || undefined),
    ownerMembershipId: z
      .string()
      .optional()
      .parse(url.searchParams.get("owner") || undefined),
    doNotContact: url.searchParams.has("doNotContact")
      ? url.searchParams.get("doNotContact") === "true"
      : undefined,
    limit: Math.min(Number(url.searchParams.get("limit") || 25), 100),
    cursor: url.searchParams.get("cursor") || undefined,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "contacts.view",
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      listContacts(tx, { tenantId: context.tenant.id, ...queryInput(request) }),
    );
    return NextResponse.json({
      ...result,
      items: result.items.map((item) => ({
        ...item,
        primaryMethod: item.primaryMethod
          ? {
              ...item.primaryMethod,
              originalValue: maskContactValue(item.primaryMethod.originalValue),
              normalizedValue: undefined,
            }
          : null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar los contactos." },
      { status: authorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "contacts.create",
    );
    const body = contactSchema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const duplicates = await findContactDuplicates(tx, {
        tenantId: context.tenant.id,
        displayName: body.displayName,
        methods: body.methods,
      });
      if (duplicates.length && !body.duplicateConfirmed) return { duplicates };
      const contact = await createContact(tx, {
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        displayName: body.displayName,
        givenName: body.givenName,
        familyName: body.familyName,
        ownerMembershipId: body.ownerMembershipId,
        doNotContact: body.doNotContact,
        doNotContactReason: body.doNotContactReason,
      });
      for (const method of body.methods)
        await addContactMethod(tx, {
          tenantId: context.tenant.id,
          contactId: contact.id,
          actorUserId: actor.userId,
          ...method,
        });
      return { contact };
    });
    if ("duplicates" in result)
      return NextResponse.json(
        { warning: "Posibles duplicados encontrados.", duplicates: result.duplicates },
        { status: 409 },
      );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el contacto." },
      { status: authorizationError(error) },
    );
  }
}
