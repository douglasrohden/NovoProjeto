#!/usr/bin/env bash
# Delega para web/ (docker compose up -d)
set -euo pipefail
exec "$(dirname "$0")/web/install.sh" "$@"
