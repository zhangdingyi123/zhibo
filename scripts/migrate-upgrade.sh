#!/usr/bin/env bash
# 在已有数据库上补跑 004–007 迁移（不会重跑 001–003 全量种子）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$ROOT/backend/migrations"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-zhibo}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-zhibo}"
MYSQL_DATABASE="${MYSQL_DATABASE:-zhibo}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-zhibo-mysql}"

export MYSQL_PWD="$MYSQL_PASSWORD"

mysql_cli() {
  if docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
    docker exec -i "$MYSQL_CONTAINER" mysql -h 127.0.0.1 -P 3306 -u "$MYSQL_USER" "$MYSQL_DATABASE" "$@"
  else
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" "$@"
  fi
}

run_sql_file() {
  local f="$1"
  echo "→ $(basename "$f")"
  if docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
    docker exec -i "$MYSQL_CONTAINER" mysql -h 127.0.0.1 -P 3306 -u "$MYSQL_USER" "$MYSQL_DATABASE" < "$f"
  else
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" < "$f"
  fi
}

has_table() {
  local name="$1"
  mysql_cli -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_name='${name}'"
}

echo "检查数据库 ${MYSQL_DATABASE} @ ${MYSQL_HOST}:${MYSQL_PORT} ..."

if [ "$(has_table live_rooms)" = "0" ]; then
  echo "缺少 live_rooms 表，执行 004_live_rooms.sql ..."
  run_sql_file "$MIG_DIR/004_live_rooms.sql"
else
  echo "✓ live_rooms 表已存在，跳过 004"
fi

echo "→ 005_seed_live_rooms.sql"
run_sql_file "$MIG_DIR/005_seed_live_rooms.sql"

if mysql_cli -N -e "SHOW COLUMNS FROM room_comments LIKE 'room_id'" | grep -q room_id; then
  echo "✓ room_comments.room_id 已存在，跳过 006"
else
  echo "执行 006_social.sql ..."
  run_sql_file "$MIG_DIR/006_social.sql"
fi

echo "→ 007_seed_social.sql"
run_sql_file "$MIG_DIR/007_seed_social.sql"

echo ""
echo "✓ 升级迁移完成。请重启后端："
echo "  docker restart zhibo-backend"
echo ""
echo "验证："
echo "  curl -s http://127.0.0.1:8081/api/v1/live-rooms?page=1 | head -c 200"
echo "  curl -s http://127.0.0.1:8081/api/v1/auctions?page=1 | head -c 200"
