import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

export function buildStoragePath(documentId: string, filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(UPLOAD_DIR, String(yyyy), mm, dd, documentId, safeName);
}

export async function saveFile(storagePath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, buffer);
}

export async function readFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(storagePath);
}
