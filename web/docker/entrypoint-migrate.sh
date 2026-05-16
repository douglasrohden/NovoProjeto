#!/bin/sh
set -e

echo "Applying Prisma migrations (production)..."
for i in $(seq 1 30); do
  if npx prisma migrate deploy; then
    echo "Migrations applied successfully."
    exit 0
  fi
  echo "  attempt ${i}/30 — waiting for PostgreSQL..."
  sleep 2
done

echo "ERROR: prisma migrate deploy failed after 30 attempts."
exit 1
