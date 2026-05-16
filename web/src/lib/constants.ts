export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const PROCESSING_TIMEOUT_MS = 30_000;
export const QUEUE_NAME = "document_jobs";

export const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
