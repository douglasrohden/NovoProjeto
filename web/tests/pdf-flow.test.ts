import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors";
import { extractPdfText } from "../src/lib/pdf";
import { extractPatterns, normalizeText } from "../src/lib/patterns";
import { validateUpload } from "../src/lib/validation";

const SAMPLE_PDF = resolve(__dirname, "..", "samples", "nota-fiscal.pdf");

describe("PDF processing pipeline", () => {
  const buffer = readFileSync(SAMPLE_PDF);

  it("accepts the sample as a valid PDF by magic bytes", () => {
    expect(validateUpload(buffer, "application/pdf")).toBe("application/pdf");
  });

  it("rejects renamed file when bytes do not match PDF signature", () => {
    const fakeBuf = Buffer.from("PKfakezip");
    let caught: AppError | null = null;
    try {
      validateUpload(fakeBuf, "application/pdf");
    } catch (err) {
      caught = err as AppError;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught?.code).toBe("INVALID_FILE_SIGNATURE");
    expect(caught?.statusCode).toBe(400);
  });

  it("extracts text from the sample PDF", async () => {
    const text = await extractPdfText(buffer);
    expect(text).toContain("Nota Fiscal");
    expect(text).toContain("ACME");
  }, 15_000);

  it("identifies date, CPF, and currency patterns in the extracted text", async () => {
    const text = normalizeText(await extractPdfText(buffer));
    const patterns = extractPatterns(text);

    const date = patterns.find((p) => p.type === "date_br");
    expect(date?.value).toBe("15/03/2026");
    expect(date?.valid).toBe(true);

    const cpf = patterns.find((p) => p.type === "cpf");
    expect(cpf?.normalized).toBe("52998224725");
    expect(cpf?.valid).toBe(true);

    const currency = patterns.find((p) => p.type === "currency_brl");
    expect(currency?.normalized).toBe("1234.56");
  }, 15_000);
});
