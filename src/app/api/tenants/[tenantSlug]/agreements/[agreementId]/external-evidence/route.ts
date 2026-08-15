import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { LocalObjectStorage } from "@/infrastructure/object-storage/local";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  recordExternalPdf,
  verifyExternalPdf,
} from "@/modules/agreements/infrastructure/repositories";

const maxBytes = 15 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; agreementId: string }> },
) {
  try {
    const { tenantSlug, agreementId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "agreements.external_evidence.upload",
    );
    const form = await request.formData();
    const file = form.get("file");
    const versionId = String(form.get("versionId") ?? "");
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      file.size < 5 ||
      file.size > maxBytes ||
      !versionId
    )
      throw new Error("EXTERNAL_PDF_INVALID");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw new Error("EXTERNAL_PDF_INVALID");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const key = `agreements/${agreementId}/external/${crypto.randomUUID()}.pdf`;
    await new LocalObjectStorage().put({
      tenantId: context.tenant.id,
      key,
      body: bytes,
      contentType: "application/pdf",
    });
    const record = await withTenantDatabase(getDatabase(), context, (tx) =>
      recordExternalPdf(tx, {
        tenantId: context.tenant.id,
        agreementId,
        versionId,
        userId: actor.userId,
        storageKey: key,
        fileSha256: sha256,
        sizeBytes: bytes.byteLength,
      }),
    );
    return NextResponse.json(
      { record, scanner: "none", status: "manual_review_required" },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el PDF externo." },
      { status: salesAuthorizationError(error) },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; agreementId: string }> },
) {
  try {
    const { tenantSlug, agreementId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "agreements.external_evidence.verify",
    );
    const body = (await request.json()) as { recordId?: string; comment?: string };
    if (!body.recordId || !body.comment?.trim())
      throw new Error("EXTERNAL_REVIEW_COMMENT_REQUIRED");
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      verifyExternalPdf(tx, {
        tenantId: context.tenant.id,
        agreementId,
        recordId: body.recordId!,
        reviewerUserId: actor.userId,
        comment: body.comment!,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo verificar la evidencia externa." },
      { status: salesAuthorizationError(error) },
    );
  }
}
