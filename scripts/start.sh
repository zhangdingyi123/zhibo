#!/usr/bin/env bash
# 一键启动：优先 Docker 全栈，否则本地 Go + Vite + Docker 仅基础设施
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env"
fi

docker_cmd() {
  if command -v docker >/dev/null 2>&1; then
    docker "$@"
    return
  fi
  if [ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
    "/Applications/Docker.app/Contents/Resources/bin/docker" "$@"
    return
  fi
  return 1
}

wait_health() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✓ $name 就绪"
      return 0
    fi
    sleep 2
  done
  echo "✗ $name 启动超时: $url" >&2
  return 1
}

if docker_cmd info >/dev/null 2>&1; then
  echo "→ 使用 Docker 部署全栈 (docker-compose.prod.yml)"
  docker_cmd compose -f docker-compose.prod.yml up -d --build
  wait_health "http://127.0.0.1:8081/api/v1/health" "后端 API"
  echo ""
  echo "访问地址："
  echo "  用户端/管理端: http://localhost:3000"
  echo "  管理后台:      http://localhost:3000/admin"
  echo "  演示直播间:    http://localhost:3000/app/live/room_live_1"
  echo "  API 健康检查:  http://localhost:8081/api/v1/health"
  exit 0
fi

echo "未检测到 Docker，改用本地开发模式（需 Go、Node、MySQL、Redis）"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
  echo "可执行: brew install go node mysql redis" >&2
    echo "或安装 Docker Desktop 后重新运行本脚本" >&2
    exit 1
  fi
}

need go
need npm
need mysql

if ! docker_cmd info >/dev/null 2>&1; then
  echo "→ 启动本地 MySQL / Redis（若已通过 brew services 安装）"
  brew services start mysql 2>/dev/null || true
  brew services start redis 2>/dev/null || true
fi

echo "→ 执行数据库迁移"
MYSQL_USER=zhibo MYSQL_PASSWORD=zhibo bash "$ROOT/scripts/migrate.sh" || {
  echo "迁移失败。若数据库未初始化，请先执行："
  echo "  mysql -uroot -e \"CREATE DATABASE IF NOT EXISTS zhibo; CREATE USER IF NOT EXISTS 'zhibo'@'localhost' IDENTIFIED BY 'zhibo'; GRANT ALL ON zhibo.* TO 'zhibo'@'localhost';\""
  exit 1
}

echo "→ 安装前端依赖"
(cd frontend && npm install)

echo "→ 启动后端 (8081)"
(cd backend && go run ./cmd/server) &
BACK_PID=$!

echo "→ 启动前端 (5173)"
(cd frontend && npm run dev) &
FRONT_PID=$!

cleanup() {
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_health "http://127.0.0.1:8081/api/v1/health" "后端 API"
echo ""
echo "访问地址："
echo "  用户端/管理端: http://localhost:5173"
echo "  管理后台:      http://localhost:5173/admin"
echo "  演示直播间:    http://localhost:5173/app/live/room_live_1"
echo "按 Ctrl+C 停止服务"

wait
