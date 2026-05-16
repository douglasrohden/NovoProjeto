#!/usr/bin/env bash
# Sobe a stack completa
set -euo pipefail

PRODUCTION=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --production|-p) PRODUCTION=true; shift ;;
    *) echo "Uso: $0 [--production]"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

COMPOSE=(docker compose -f docker-compose.yml)
if [[ "$PRODUCTION" == true ]]; then
  COMPOSE+=(-f docker-compose.prod.yml)
fi
COMPOSE+=(up -d)

"${COMPOSE[@]}"

echo ""
echo "Stack iniciada."
echo "  App:    http://localhost:${API_PORT:-3000}"
echo "  Health: http://localhost:${API_PORT:-3000}/api/health"
echo ""
echo "Logs: docker compose logs -f web worker"
