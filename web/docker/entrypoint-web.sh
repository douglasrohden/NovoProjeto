#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if npx prisma migrate deploy 2>/dev/null; then
    echo "Migrations applied."
    break
  fi
  echo "  retry $i/15..."
  sleep 2
done

echo "Starting Next.js on port ${PORT:-3000}..."
exec npm start
