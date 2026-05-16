#!/bin/sh
set -e

echo "Waiting for Redis..."
sleep 3

echo "Starting worker..."
exec npx tsx worker/index.ts
