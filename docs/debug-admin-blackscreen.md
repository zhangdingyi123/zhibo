# 管理端 `/admin/live-rooms/2` 黑屏排查

## 30 秒确认：是不是 JS 没加载？

1. 打开 `http://47.97.176.185/admin/live-rooms/2`
2. `F12` → **Network**，勾选 **Disable cache**，刷新
3. 看两类请求：

| 现象 | 结论 |
|------|------|
| `index-*.js` / `assets/*.js` **404**，URL 像 `/admin/live-rooms/assets/...` | **嵌套路由资源路径错误**（Vite `base` 或相对路径） |
| 文档 HTML **404**（nginx 页面） | **外层 nginx 未 SPA fallback** |
| 所有 JS **200**，Console 有红色报错 | **运行时崩溃**（看 LiveRoomConsolePage） |
| JS 200，Console 无报错，只有黑底+小图 | **业务渲染问题**（视频占位/空数据） |

4. **Console** 常见报错：
   - `Failed to load module script` → MIME/路径问题
   - `Unexpected token <` → 把 HTML 当 JS 加载（404 回退页）
   - `Cannot read properties of undefined` → 页面组件运行时错误

## 修复 1：Vite 资源必须用绝对路径

`frontend/vite.config.ts`：

```ts
export default defineConfig({
  base: '/', // 不要用 './'
  // ...
})
```

改后重新 `npm run build` 并部署 frontend 镜像。

构建产物 `dist/index.html` 里 script 应是：

```html
<script type="module" src="/assets/index-xxxxx.js"></script>
```

**不能**是 `./assets/...` 或 `assets/...`（否则深链 `/admin/live-rooms/2` 会去请求 `/admin/live-rooms/assets/...`）。

## 修复 2：前端容器 nginx SPA fallback

`frontend/nginx.conf`：

```nginx
location / {
    root   /usr/share/nginx/html;
    index  index.html;
    try_files $uri $uri/ /index.html;
}
```

## 修复 3：外层 nginx 不要把 `/admin` 代理到后端

`deploy/nginx.conf` 中：

- `/api/` → backend
- `/` → **frontend 容器**（由 frontend 内层 nginx 做 try_files）

**错误示例**（会导致 admin 路由返回 JSON/404）：

```nginx
location /admin/ {
    proxy_pass http://backend:8081;
}
```

## 修复 4：LiveRoomConsolePage 运行时

若 JS 均 200 仍黑屏，检查：

- `AdminRoutes.tsx` 路由 param 名与 `useParams()` 一致（`:id` vs `:roomId`）
- loading/error 不要 `return null`，应显示 Spinner 或错误文案
- API `GET /api/v1/admin/live-rooms/2` 是否 401/404

## 本地快速复现

```bash
cd frontend && npm run build && npm run preview
# 访问 http://localhost:4173/admin/live-rooms/2
```

若 preview 也黑屏 → 前端配置/组件问题；若 preview 正常、线上黑屏 → nginx/部署问题。
