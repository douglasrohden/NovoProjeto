import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, errorResponse, getRequestId } from "@/lib/errors";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const groupBy = url.searchParams.get("group_by") ?? "day";

    if (from && to && new Date(from) > new Date(to)) {
      throw new AppError(400, "INVALID_DATE_RANGE", "'from' must be before 'to'");
    }

    const where: Prisma.DocumentWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [total, docsForPeriod] = await Promise.all([
      prisma.document.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      groupBy
        ? prisma.document.findMany({
            where,
            select: { createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const bucketKey = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      if (groupBy === "month") return `${y}-${m}`;
      if (groupBy === "week") {
        const onejan = new Date(Date.UTC(y, 0, 1));
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
        return `${y}-W${String(week).padStart(2, "0")}`;
      }
      return `${y}-${m}-${day}`;
    };

    const periodMap = new Map<string, number>();
    for (const d of docsForPeriod) {
      const key = bucketKey(d.createdAt);
      periodMap.set(key, (periodMap.get(key) ?? 0) + 1);
    }
    const grouped = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ bucket: date, count }));

    const byStatus: Record<string, number> = {};
    for (const s of Object.values(DocumentStatus)) byStatus[s] = 0;
    let documents = 0;
    for (const row of total) {
      byStatus[row.status] = row._count._all;
      documents += row._count._all;
    }

    return Response.json({
      period: { from: from ?? null, to: to ?? null },
      totals: { documents, by_status: byStatus },
      by_period: grouped.map((r) => ({
        date: String(r.bucket),
        count: r.count,
      })),
    });
  } catch (err) {
    return errorResponse(err, requestId);
  }
}
