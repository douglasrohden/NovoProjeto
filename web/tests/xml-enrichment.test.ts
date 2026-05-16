import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { parseEnrichmentXml, validateXmlAgainstXsd } from "../src/lib/xml";

const VALID_XML = resolve(__dirname, "..", "samples", "enrichment-example.xml");
const INVALID_XML = resolve(__dirname, "..", "samples", "enrichment-invalid.xml");

function hasXmllint(): boolean {
  try {
    execSync("xmllint --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const xmllintAvailable = hasXmllint();

describe("XML enrichment parsing", () => {
  it("parses the example XML into the expected shape", () => {
    const content = readFileSync(VALID_XML, "utf-8");
    const parsed = parseEnrichmentXml(content);

    expect(parsed.version).toBe("1.0");
    expect(parsed.client.code).toBe("ACME01");
    expect(parsed.reference.id).toBe("INV-2026-0042");
    expect(parsed.reference.type).toBe("invoice");
    expect(parsed.fields.issue_date).toBe("15/03/2026");
    expect(parsed.fields.total_amount).toBe("1500.00");
  });
});

describe.skipIf(!xmllintAvailable)("XML schema validation (requires xmllint)", () => {
  it("accepts a conforming XML", async () => {
    const content = readFileSync(VALID_XML, "utf-8");
    await expect(validateXmlAgainstXsd(content)).resolves.toBeUndefined();
  });

  it("rejects a non-conforming XML with a descriptive error", async () => {
    const content = readFileSync(INVALID_XML, "utf-8");
    await expect(validateXmlAgainstXsd(content)).rejects.toThrow();
  });
});
