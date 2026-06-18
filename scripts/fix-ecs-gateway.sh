#!/usr/bin/env bash
# 修复 ECS 80 端口「随机 500」：删掉旧 backend、校正网关 upstream、更新 CORS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ 1. 停止并删除旧后端容器（若存在）"
docker rm -f zhibo-backend-2 2>/dev/null || true

echo "→ 2. 确认新后端健康"
if ! curl -fsS --max-time 5 "http://127.0.0.1:8081/api/v1/health" >/dev/null; then
  echo "⚠ zhibo-backend:8081 未响应，请先: docker-compose -f docker-compose.prod.yml up -d backend" >&2
  exit 1
fi
echo "✓ 8081 健康"

echo "→ 3. 写入 CORS 白名单（80 + 8088）"
PUB_IP="$(curl -fsS --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)"
if [ -z "$PUB_IP" ]; then
  PUB_IP="$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || true)"
fi
if [ -n "$PUB_IP" ] && [ -f .env ]; then
  FRONTEND_URL="http://${PUB_IP}:8088"
  FRONTEND_URLS="http://${PUB_IP},http://${PUB_IP}:8088,http://${PUB_IP}:80,http://127.0.0.1:8088"
  if grep -q '^FRONTEND_URL=' .env; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONTEND_URL}|" .env
  else
    echo "FRONTEND_URL=${FRONTEND_URL}" >> .env
  fi
  if grep -q '^FRONTEND_URLS=' .env; then
    sed -i "s|^FRONTEND_URLS=.*|FRONTEND_URLS=${FRONTEND_URLS}|" .env
  else
    echo "FRONTEND_URLS=${FRONTEND_URLS}" >> .env
  fi
  echo "  FRONTEND_URL=${FRONTEND_URL}"
  echo "  FRONTEND_URLS=${FRONTEND_URLS}"
  if docker ps --format '{{.Names}}' | grep -qx zhibo-backend; then
    docker-compose -f docker-compose.prod.yml up -d --no-deps backend 2>/dev/null \
      || docker restart zhibo-backend
  fi
fi

echo "→ 4. 校正 80 端口网关 nginx（仅保留 zhibo-backend）"
GATEWAY_CONF="${GATEWAY_CONF:-/opt/zhibo/deploy/nginx.conf}"
if [ -f "$GATEWAY_CONF" ]; then
  cp -a "$GATEWAY_CONF" "${GATEWAY_CONF}.bak.$(date +%Y%m%d%H%M%S)"
  sed -i '/zhibo-backend-2/d' "$GATEWAY_CONF"
  sed -i 's/server backend:8081/server zhibo-backend:8081/g' "$GATEWAY_CONF"
  if docker ps --format '{{.Names}}' | grep -qx zhibo-nginx; then
    docker exec zhibo-nginx nginx -t
    docker exec zhibo-nginx nginx -s reload
    echo "✓ 已 reload zhibo-nginx"
  else
    echo "  已更新 $GATEWAY_CONF，请手动 reload 网关 nginx 容器"
  fi
elif [ -f "$ROOT/deploy/nginx.gateway.conf" ]; then
  echo "  未找到 $GATEWAY_CONF，可将 deploy/nginx.gateway.conf 复制到该路径后启动网关"
else
  echo "  跳过：无网关配置文件"
fi

echo "→ 5. 确保 nginx 与 backend 在同一 Docker 网络"
NET="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' zhibo-backend 2>/dev/null | head -1)"
if [ -n "$NET" ] && docker ps --format '{{.Names}}' | grep -qx zhibo-nginx; then
  docker network connect "$NET" zhibo-nginx 2>/dev/null || true
fi

echo ""
echo "验证（应连续 5 次都是 code:0）："
for i in 1 2 3 4 5; do
  printf "  #%s auctions: " "$i"
  curl -s --max-time 3 "http://127.0.0.1/api/v1/auctions?page=1" \
    -H "Origin: http://${PUB_IP:-127.0.0.1}" | head -c 60 || true
  echo ""
done
echo ""
echo "推荐访问: http://${PUB_IP:-<公网IP>}:8088/app"
