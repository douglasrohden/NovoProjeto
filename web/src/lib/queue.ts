import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAME } from "./constants";

let connection: IORedis | null = null;
let documentQueue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return connection;
}

export function getDocumentQueue(): Queue {
  if (!documentQueue) {
    documentQueue = new Queue(QUEUE_NAME, { connection: getConnection() });
  }
  return documentQueue;
}

export async function enqueueDocument(documentId: string): Promise<void> {
  const conn = getConnection();
  if (conn.status !== "ready") {
    await conn.connect();
  }
  const queue = getDocumentQueue();
  await queue.add(
    "process",
    { documentId },
    {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}

export function getRedisConnection(): IORedis {
  return getConnection();
}
