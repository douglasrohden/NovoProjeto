import { prisma } from "@/lib/db";
import { AppError, errorResponse, getRequestId } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const requestId = getRequestId(req);
  try {
    const { id } = await params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document ${id} not found`);
    }

    return Response.json({
      id: doc.id,
      status: doc.status,
      filename: doc.filename,
      mime_type: doc.mimeType,
      size_bytes: doc.sizeBytes,
      extracted_text: doc.extractedText,
      patterns: doc.patterns,
      enrichment: doc.enrichment,
      error_message: doc.errorMessage,
      client_code: doc.clientCode,
      created_at: doc.createdAt.toISOString(),
      updated_at: doc.updatedAt.toISOString(),
      processed_at: doc.processedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
