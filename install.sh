#!/usr/bin/env bash
# Delega para web/ (docker build + compose)
set -euo pipefail
exec "$(dirname "$0")/web/install.sh" "$@"
