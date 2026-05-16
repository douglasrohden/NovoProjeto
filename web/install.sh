#!/usr/bin/env bash
# Sobe toda a stack com um único comando (requisito do desafio).
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

docker compose up -d --build

echo ""
echo "Stack iniciada."
echo "  App:    http://localhost:${API_PORT:-3000}"
echo "  Health: http://localhost:${API_PORT:-3000}/api/health"
echo ""
echo "Logs: docker compose logs -f web worker"
