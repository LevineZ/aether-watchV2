# Live field cache（lite）

## 做什么
- **洋流**：NASA OSCAR v2.0 NRT → `.cache/fields/{packId}/`
- **风 / 气温 / 降雨**：Open-Meteo Forecast `current` → 同形状（气温/降雨含 `scalar.bin`）
- **TTL**：默认 6h（`FIELD_CACHE_TTL_SECONDS=21600`）；命中只读盘
- **429**：断点续传粗网格；仍失败则保留旧包，否则前端回退 DEMO

## 采样（免费档友好）
- 全球：默认 `OPEN_METEO_STEP_DEG=10` → 升采样到 `721×361`（有 key 可改小到 2.5）
- 中国窗：1° → `249×145`
- 区域：0.5° → `141×131`
- 同一 scope 一次拉数写齐兄弟包

## `.env` 键名（值勿进仓）
见 `.env.example`。`OPEN_METEO_STEP_DEG` **只作用于 global**。

## 命令
```bash
pnpm cache:status
pnpm cache:ocean / cache:regional   # OSCAR
pnpm cache:om                       # global wind+temp+precip
pnpm cache:china
pnpm --filter @aether/web dev       # :8765
```

## HTTP
- `GET /api/fields/status`
- `GET /api/fields/global/wind/meta.json`（miss/stale 时自动拉数）
- `GET /api/fields/global/{wind,temp,precip}/{u,v,scalar}.bin`

## 预览
http://localhost:8765/global → 左下切 **风 / 气温 / 降雨 / 洋流**；控制台 `meta.source=live`。
