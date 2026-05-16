import { prisma } from "@/lib/db";
import { getRedisConnection } from "@/lib/queue";

export async function GET() {
  let database: "connected" | "disconnected" = "disconnected";
  let redis: "connected" | "disconnected" = "disconnected";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "disconnected";
  }

  try {
    const conn = getRedisConnection();
    if (conn.status !== "ready" && conn.status !== "connecting") await conn.connect();
    await conn.ping();
    redis = "connected";
  } catch {
    redis = "disconnected";
  }

  const ok = database === "connected" && redis === "connected";
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      version: "1.0.0",
      database,
      redis,
    },
    { status: ok ? 200 : 503 }
  );
}
