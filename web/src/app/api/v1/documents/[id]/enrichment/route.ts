import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, errorResponse, getRequestId } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { loadXmlFromBuffer, parseEnrichmentXml, validateXmlAgainstXsd } from "@/lib/xml";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document ${id} not found`);
    }

    if (doc.status === DocumentStatus.pending || doc.status === DocumentStatus.processing) {
      throw new AppError(
        409,
        "DOCUMENT_NOT_READY",
        "Document is still being processed"
      );
    }
    if (doc.status === DocumentStatus.failed) {
      throw new AppError(
        409,
        "DOCUMENT_PROCESSING_FAILED",
        "Document processing failed; cannot enrich"
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError(400, "MISSING_FILE", "Field 'file' is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const xmlContent = await loadXmlFromBuffer(buffer);

    try {
      await validateXmlAgainstXsd(xmlContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(422, "XML_VALIDATION_ERROR", "XML does not conform to schema", {
        validation_errors: [msg],
      });
    }

    let enrichment;
    try {
      enrichment = parseEnrichmentXml(xmlContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(422, "XML_PARSE_ERROR", msg);
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.enriched,
        enrichment: enrichment as object,
        clientCode: enrichment.client.code,
      },
    });

    logEvent("document.enrichment_completed", {
      request_id: requestId,
      document_id: id,
      client_code: enrichment.client.code,
    });

    return Response.json({
      id: updated.id,
      status: updated.status,
      enrichment: updated.enrichment,
    });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
