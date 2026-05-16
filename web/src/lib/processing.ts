import { Document, DocumentStatus } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./errors";
import { logEvent } from "./logger";
import { processDocument } from "./processor";
import { enqueueDocument } from "./queue";

function useInlineProcessing(): boolean {
  const flag = process.env.PROCESS_INLINE?.toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export async function scheduleDocumentProcessing(documentId: string): Promise<void> {
  if (useInlineProcessing()) {
    logEvent("document.processing_inline", { document_id: documentId });
    void processDocument(documentId);
    return;
  }

  try {
    await enqueueDocument(documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent(
      "document.queue_failed_fallback_inline",
      { document_id: documentId, error: message },
      "warn"
    );
    void processDocument(documentId);
  }
}

const READY: DocumentStatus[] = [DocumentStatus.processed, DocumentStatus.enriched];

export async function ensureDocumentProcessed(
  documentId: string,
  timeoutMs = 90_000
): Promise<Document> {
  let doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document ${documentId} not found`);
  }

  if (READY.includes(doc.status)) return doc;
  if (doc.status === DocumentStatus.failed) {
    throw new AppError(
      409,
      "DOCUMENT_PROCESSING_FAILED",
      doc.errorMessage ?? "Document processing failed; cannot enrich"
    );
  }

  if (doc.status === DocumentStatus.pending) {
    await scheduleDocumentProcessing(documentId);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(500);
    doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", `Document ${documentId} not found`);
    }
    if (READY.includes(doc.status)) return doc;
    if (doc.status === DocumentStatus.failed) {
      throw new AppError(
        409,
        "DOCUMENT_PROCESSING_FAILED",
        doc.errorMessage ?? "Document processing failed; cannot enrich"
      );
    }
  }

  throw new AppError(409, "DOCUMENT_NOT_READY", "Document processing did not finish in time", {
    status: doc.status,
    hint: "Check worker logs or set PROCESS_INLINE=true in .env for local dev without Redis.",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
