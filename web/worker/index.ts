import { Worker } from "bullmq";
import { QUEUE_NAME } from "../src/lib/constants";
import { logEvent } from "../src/lib/logger";
import { processDocument } from "../src/lib/processor";
import { getRedisConnection } from "../src/lib/queue";

async function main() {
  logEvent("worker.started", { queue: QUEUE_NAME });

  const redis = getRedisConnection();
  await redis.connect();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { documentId } = job.data as { documentId: string };
      await processDocument(documentId);
    },
    {
      connection: redis,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10),
    }
  );

  worker.on("failed", (job, err) => {
    logEvent("worker.job_failed", { job_id: job?.id, error: err.message }, "error");
  });

  process.on("SIGTERM", async () => {
    await worker.close();
    await redis.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
