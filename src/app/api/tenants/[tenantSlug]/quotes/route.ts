import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { createQuote, listQuotes } from "@/modules/quotes/infrastructure/repositories";

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/),
  unitPriceMinor: z.string().regex(/^\d+$/).transform(BigInt),
  discount: z.object({
    type: z.enum(["none", "percent", "fixed"]),
    value: z.string().regex(/^\d+$/).transform(BigInt),
  }),
  taxRateBps: z.string().regex(/^\d+$/).transform(BigInt),
});

function serializeQuoteRow(row: {
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  [key: string]: unknown;
}) {
  return {
    ...row,
    subtotalMinor: row.subtotalMinor.toString(),
    discountMinor: row.discountMinor.toString(),
    taxMinor: row.taxMinor.toString(),
    totalMinor: row.totalMinor.toString(),
  };
}
const bodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  currency: z.string().regex(/^[A-Z]{3}$/),
  accountId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  lines: z.array(lineSchema).min(1).max(100),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "quotes.view",
    );
    return NextResponse.json(
      (
        await withTenantDatabase(getDatabase(), context, (tx) =>
          listQuotes(tx, context.tenant.id),
        )
      ).map(serializeQuoteRow),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las cotizaciones." },
      { status: salesAuthorizationError(error) },
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
      "quotes.create",
    );
    const body = bodySchema.parse(await request.json());
    const quote = await withTenantDatabase(getDatabase(), context, (tx) =>
      createQuote(tx, {
        ...body,
        tenantId: context.tenant.id,
        actorUserId: actor.userId,
        ownerMembershipId: context.membership.id,
      }),
    );
    return NextResponse.json(
      {
        quote: {
          ...quote,
          totals: Object.fromEntries(
            Object.entries(quote.totals).map(([key, value]) => [
              key,
              value.toString(),
            ]),
          ),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la cotización." },
      { status: salesAuthorizationError(error) },
    );
  }
}
