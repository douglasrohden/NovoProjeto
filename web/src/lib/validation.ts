import { MAX_FILE_SIZE_BYTES, PDF_SIGNATURE, PNG_SIGNATURE } from "./constants";
import { AppError } from "./errors";

export type AllowedMime = "application/pdf" | "image/png";

export function detectFileType(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_SIGNATURE)) {
    return "application/pdf";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  return null;
}

export function validateUpload(buffer: Buffer, _declaredMime?: string | null): AllowedMime {
  if (buffer.length === 0) {
    throw new AppError(400, "MISSING_FILE", "File is empty or missing");
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit`);
  }
  const detected = detectFileType(buffer);
  if (!detected) {
    throw new AppError(400, "INVALID_FILE_SIGNATURE", "Only PDF and PNG files are allowed");
  }
  return detected;
}
