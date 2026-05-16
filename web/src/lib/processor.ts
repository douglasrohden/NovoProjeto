import { DocumentStatus } from "@prisma/client";
import { PROCESSING_TIMEOUT_MS } from "./constants";
import { prisma } from "./db";
import { logEvent } from "./logger";
import { extractImageText } from "./ocr";
import { extractPatterns, normalizeText } from "./patterns";
import { extractPdfText } from "./pdf";
import { readFile } from "./storage";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Processing timeout exceeded")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function processDocument(documentId: string): Promise<void> {
  const start = Date.now();
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    logEvent("document.not_found", { document_id: documentId }, "warn");
    return;
  }
  if (doc.status !== DocumentStatus.pending) {
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.processing },
  });

  logEvent("document.processing_started", {
    document_id: documentId,
    filename: doc.filename,
  });

  try {
    const buffer = await withTimeout(readFile(doc.storagePath), PROCESSING_TIMEOUT_MS);
    let extracted = "";

    if (doc.mimeType === "application/pdf") {
      extracted = await withTimeout(extractPdfText(buffer), PROCESSING_TIMEOUT_MS);
      if (extracted.length < 50) {
        extracted = await withTimeout(extractImageText(buffer), PROCESSING_TIMEOUT_MS);
      }
    } else {
      extracted = await withTimeout(extractImageText(buffer), PROCESSING_TIMEOUT_MS);
    }

    if (!extracted.trim()) {
      throw new Error("OCR produced empty text");
    }

    const normalized = normalizeText(extracted);
    const patterns = extractPatterns(normalized);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.processed,
        extractedText: normalized,
        patterns: patterns as object[],
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    logEvent("document.processing_completed", {
      document_id: documentId,
      duration_ms: Date.now() - start,
      pattern_count: patterns.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal processing error";
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.failed,
        errorMessage: message,
      },
    });
    logEvent(
      "document.processing_failed",
      {
        document_id: documentId,
        duration_ms: Date.now() - start,
        error: message,
      },
      "error"
    );
  }
}
