import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { XMLParser } from "fast-xml-parser";

export interface EnrichmentData {
  version: string;
  client: { code: string; name?: string };
  reference: { id: string; type: string; externalId?: string };
  fields: Record<string, string>;
  metadata?: Record<string, string>;
  imported_at: string;
}

function getXsdPath(): string {
  return (
    process.env.XML_SCHEMA_PATH ??
    path.join(process.cwd(), "docs", "xml-schema.xsd")
  );
}

export async function validateXmlAgainstXsd(xmlContent: string): Promise<void> {
  const xsdPath = getXsdPath();
  const tmpFile = path.join(os.tmpdir(), `doc-${Date.now()}.xml`);
  fs.writeFileSync(tmpFile, xmlContent, "utf-8");
  try {
    execSync(`xmllint --noout --schema "${xsdPath}" "${tmpFile}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: Buffer }).stderr)
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(stderr.trim() || "XML does not conform to schema");
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

export function parseEnrichmentXml(xmlContent: string): EnrichmentData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xmlContent);
  const root = parsed.DocumentEnrichment;
  if (!root) throw new Error("Missing DocumentEnrichment root element");

  const fields: Record<string, string> = {};
  const fieldList = root.Fields?.Field;
  const fieldsArray = Array.isArray(fieldList) ? fieldList : fieldList ? [fieldList] : [];
  for (const f of fieldsArray) {
    const name = f["@_name"];
    const val =
      typeof f === "string" ? f : (f["#text"] ?? (typeof f === "object" ? String(Object.values(f)[0]) : String(f)));
    if (name) fields[name] = String(val).trim();
  }

  const meta: Record<string, string> = {};
  if (root.Metadata) {
    for (const [k, v] of Object.entries(root.Metadata)) {
      if (v != null && typeof v !== "object") meta[k] = String(v);
    }
  }

  return {
    version: root["@_version"] ?? "1.0",
    client: {
      code: root.Client?.["@_code"] ?? "",
      name: root.Client?.["@_name"],
    },
    reference: {
      id: root.Reference?.["@_id"] ?? "",
      type: root.Reference?.["@_type"] ?? "other",
      externalId: root.Reference?.["@_externalId"],
    },
    fields,
    metadata: Object.keys(meta).length ? meta : undefined,
    imported_at: new Date().toISOString(),
  };
}

export async function loadXmlFromBuffer(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}
