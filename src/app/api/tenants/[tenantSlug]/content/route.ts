import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  createContent,
  createIdea,
  createNote,
  listContent,
  listIdeas,
  listNotes,
} from "@/modules/content-planning/infrastructure/repositories";

const schema = z.object({
  kind: z.enum(["idea", "note", "content"]),
  title: z.string().min(1).max(240),
  body: z.string().max(10000).optional(),
  brandId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  plannedDate: z.string().optional(),
  timezone: z.string().default("America/Tijuana"),
  sourceIdeaId: z.string().optional(),
  sourceNoteId: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "content.read",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, async (tx) => ({
        content: await listContent(tx, context.tenant.id),
        ideas: await listIdeas(tx, context.tenant.id),
        notes: await listNotes(tx, context.tenant.id),
      })),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el espacio editorial." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "content.manage",
    );
    const input = schema.parse(await request.json());
    const result =
      input.kind === "idea"
        ? await withTenantDatabase(getDatabase(), context, (tx) =>
            createIdea(tx, {
              tenantId: context.tenant.id,
              membershipId: context.membership.id,
              title: input.title,
              body: input.body,
              brandId: input.brandId,
              accountId: input.accountId,
            }),
          )
        : input.kind === "note"
          ? await withTenantDatabase(getDatabase(), context, (tx) =>
              createNote(tx, {
                tenantId: context.tenant.id,
                membershipId: context.membership.id,
                title: input.title,
                body: input.body ?? "",
                accountId: input.accountId,
              }),
            )
          : await withTenantDatabase(getDatabase(), context, (tx) =>
              createContent(tx, {
                tenantId: context.tenant.id,
                membershipId: context.membership.id,
                brandId: input.brandId!,
                title: input.title,
                plannedDate: input.plannedDate,
                timezone: input.timezone,
                sourceIdeaId: input.sourceIdeaId,
                sourceNoteId: input.sourceNoteId,
              }),
            );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar el elemento editorial." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
