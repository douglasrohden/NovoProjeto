import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { errorResponse, getRequestId } from "@/lib/errors";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DocumentStatus | null;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const hasEnrichment = url.searchParams.get("has_enrichment");

    const where: Prisma.DocumentWhereInput = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (hasEnrichment === "true") where.enrichment = { not: Prisma.DbNull };
    if (hasEnrichment === "false") where.enrichment = { equals: Prisma.DbNull };

    const docs = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        filename: true,
        status: true,
        clientCode: true,
        createdAt: true,
        processedAt: true,
        enrichment: true,
        patterns: true,
      },
    });

    const header =
      "id,filename,status,client_code,created_at,processed_at,has_enrichment,pattern_count";
    const rows = docs.map((d) => {
      const patternCount = Array.isArray(d.patterns) ? d.patterns.length : 0;
      return [
        d.id,
        `"${d.filename.replace(/"/g, '""')}"`,
        d.status,
        d.clientCode ?? "",
        d.createdAt.toISOString(),
        d.processedAt?.toISOString() ?? "",
        d.enrichment != null,
        patternCount,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="documents-report.csv"',
        "X-Request-ID": requestId,
      },
    });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
