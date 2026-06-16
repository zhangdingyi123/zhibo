#!/usr/bin/env bash
# 按序执行 backend/migrations/*.sql
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$ROOT/backend/migrations"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-zhibo}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-zhibo}"
MYSQL_DATABASE="${MYSQL_DATABASE:-zhibo}"

if ! command -v mysql >/dev/null 2>&1; then
  echo "未找到 mysql 客户端，请安装后重试" >&2
  exit 1
fi

export MYSQL_PWD="$MYSQL_PASSWORD"

run_sql() {
  local f="$1"
  echo "→ $(basename "$f")"
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" < "$f"
}

for f in "$MIG_DIR"/*.sql; do
  [ -f "$f" ] || continue
  run_sql "$f"
done

echo "✓ 全部迁移完成"
