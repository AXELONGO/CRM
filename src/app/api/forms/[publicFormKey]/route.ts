import { NextResponse } from "next/server";
import { getIngressDatabase } from "@/infrastructure/database/client";
import { and, eq } from "drizzle-orm";
import { inboxForms } from "@/infrastructure/database/schema";
import { createHash } from "node:crypto";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicFormKey: string }> },
) {
  const { publicFormKey } = await params;
  const [form] = await getIngressDatabase()
    .select({
      name: inboxForms.name,
      fields: inboxForms.fields,
      consentText: inboxForms.consentText,
    })
    .from(inboxForms)
    .where(
      and(
        eq(
          inboxForms.publicKeyHash,
          createHash("sha256").update(publicFormKey).digest("hex"),
        ),
        eq(inboxForms.status, "active"),
      ),
    )
    .limit(1);
  if (!form)
    return NextResponse.json({ error: "Formulario no encontrado." }, { status: 404 });
  return NextResponse.json(form);
}
