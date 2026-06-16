#!/usr/bin/env bash
# 阿里云 ECS / Linux 一键部署
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi
  echo "未找到 docker compose，请先安装：" >&2
  echo "  curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose" >&2
  echo "  chmod +x /usr/local/bin/docker-compose" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  echo "未安装 Docker。阿里云 ECS 可执行：" >&2
  echo "  curl -fsSL https://get.docker.com | sh" >&2
  echo "  systemctl enable --now docker" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker 未运行，请执行: systemctl start docker" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "找不到 $COMPOSE_FILE，请确认在项目根目录（含 backend/ frontend/）" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

# 自动写入公网访问地址（供后端 CORS）
if ! grep -q '^FRONTEND_URL=' .env || grep -q 'localhost' .env; then
  PUB_IP="$(curl -fsS --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)"
  if [ -z "$PUB_IP" ]; then
    PUB_IP="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || true)"
  fi
  if [ -n "$PUB_IP" ]; then
    if grep -q '^FRONTEND_URL=' .env; then
      sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=http://${PUB_IP}:3000|" .env
    else
      echo "FRONTEND_URL=http://${PUB_IP}:3000" >> .env
    fi
    echo "已设置 FRONTEND_URL=http://${PUB_IP}:3000"
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "→ 构建并启动容器..."
compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "等待服务就绪..."
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:8081/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -fsS "http://127.0.0.1:8081/api/v1/health" >/dev/null 2>&1; then
  echo "✓ 后端健康检查通过"
else
  echo "⚠ 后端尚未就绪，查看日志: compose -f $COMPOSE_FILE logs -f backend"
fi

PUB="${FRONTEND_URL:-http://localhost:3000}"
echo ""
echo "部署完成。请在阿里云安全组放行 TCP 端口: 3000, 8081"
echo ""
echo "访问地址："
echo "  前端:     ${PUB}"
echo "  管理后台: ${PUB}/admin"
echo "  演示直播: ${PUB}/app/live/room_live_1"
echo "  API:      http://$(echo "$PUB" | sed 's|:3000||'):8081/api/v1/health"
echo ""
echo "常用命令："
echo "  compose -f $COMPOSE_FILE ps"
echo "  compose -f $COMPOSE_FILE logs -f"
echo "  compose -f $COMPOSE_FILE down"
