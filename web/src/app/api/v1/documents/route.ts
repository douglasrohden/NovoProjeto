import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, errorResponse, getRequestId } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { scheduleDocumentProcessing } from "@/lib/processing";
import { buildStoragePath, saveFile } from "@/lib/storage";
import { validateUpload } from "@/lib/validation";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError(400, "MISSING_FILE", "Field 'file' is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = validateUpload(buffer, file.type);
    const id = crypto.randomUUID();
    const storagePath = buildStoragePath(id, file.name);
    await saveFile(storagePath, buffer);

    const doc = await prisma.document.create({
      data: {
        id,
        filename: file.name,
        mimeType,
        sizeBytes: buffer.length,
        storagePath,
        status: DocumentStatus.pending,
      },
    });

    await scheduleDocumentProcessing(id);

    logEvent("document.uploaded", {
      request_id: requestId,
      document_id: id,
      filename: file.name,
      mime_type: mimeType,
      size_bytes: buffer.length,
    });

    return Response.json(
      {
        id: doc.id,
        status: doc.status,
        filename: doc.filename,
        created_at: doc.createdAt.toISOString(),
      },
      { status: 201, headers: { "X-Request-ID": requestId } }
    );
  } catch (err) {
    return errorResponse(err, requestId);
  }
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DocumentStatus | null;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const hasEnrichment = url.searchParams.get("has_enrichment");
    const clientCode = url.searchParams.get("client_code");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

    const where: Prisma.DocumentWhereInput = {};
    if (status) where.status = status;
    if (clientCode) where.clientCode = clientCode;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (hasEnrichment === "true") where.enrichment = { not: Prisma.DbNull };
    if (hasEnrichment === "false") where.enrichment = { equals: Prisma.DbNull };

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          filename: true,
          clientCode: true,
          createdAt: true,
          processedAt: true,
          enrichment: true,
          patterns: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    return Response.json({
      items: items.map((d) => ({
        id: d.id,
        status: d.status,
        filename: d.filename,
        client_code: d.clientCode,
        created_at: d.createdAt.toISOString(),
        processed_at: d.processedAt?.toISOString() ?? null,
        has_enrichment: d.enrichment != null,
        pattern_count: Array.isArray(d.patterns) ? d.patterns.length : 0,
      })),
      total,
      page,
      page_size: pageSize,
    });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
