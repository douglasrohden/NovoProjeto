import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

interface TextItem {
  str: string;
  hasEOL?: boolean;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = getDocument({
    data: uint8,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as TextItem[])
        .map((item) => (item.hasEOL ? `${item.str}\n` : item.str))
        .join(" ");
      parts.push(pageText);
      page.cleanup();
    }
  } finally {
    await pdf.cleanup();
    await pdf.destroy();
  }
  return parts.join("\n").trim();
}
