#!/bin/sh
set -e

echo "Waiting for Redis..."
until node -e "
const Redis = require('ioredis');
const r = new Redis(process.env.REDIS_URL || 'redis://redis:6379', { maxRetriesPerRequest: 1 });
r.ping().then(() => { r.quit(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "Starting worker..."
exec npx tsx worker/index.ts
