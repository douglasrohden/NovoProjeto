#!/usr/bin/env bash
# Build da imagem + sobe a stack
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

IMAGE="${APP_IMAGE:-document-platform:latest}"
if [[ -f .env ]]; then
  val=$(grep -E '^\s*APP_IMAGE=' .env | tail -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -n "$val" ]] && IMAGE="$val"
fi

echo "Building image ${IMAGE} ..."
docker build -t "${IMAGE}" .

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
