import Tesseract from "tesseract.js";
import { logEvent } from "./logger";

const TESSDATA_PATH = process.env.TESSDATA_PATH;

export async function extractImageText(buffer: Buffer): Promise<string> {
  const lang = process.env.TESSERACT_LANG ?? "por";
  const start = Date.now();
  const options: Record<string, unknown> = { logger: () => {} };
  if (TESSDATA_PATH) {
    options.langPath = TESSDATA_PATH;
    options.cacheMethod = "none";
    options.gzip = true;
  }
  const result = await Tesseract.recognize(
    buffer,
    lang,
    options as Parameters<typeof Tesseract.recognize>[2]
  );
  logEvent("ocr.completed", { duration_ms: Date.now() - start, lang });
  return (result.data.text ?? "").trim();
}
