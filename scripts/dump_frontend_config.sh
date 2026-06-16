#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in \
  frontend/vite.config.ts \
  frontend/index.html \
  frontend/nginx.conf \
  deploy/nginx.conf \
  frontend/src/main.tsx \
  frontend/src/admin/AdminRoutes.tsx \
  frontend/src/admin/pages/LiveRoomConsolePage.tsx; do
  echo "======== $f ========"
  cat "$ROOT/$f" || echo "(missing)"
done
