#!/bin/sh
set -e
echo "Starting Next.js on port ${PORT:-3000}..."
exec npm start
