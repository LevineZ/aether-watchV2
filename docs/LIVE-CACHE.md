# Live field cache（lite）

## 做什么
- **洋流**：NASA OSCAR v2.0 NRT → 落盘 `.cache/fields/{packId}/`（与 DEMO 同形状：`meta.json` + `u.bin`/`v.bin`/`mask.bin`）
- **TTL**：默认 6 小时（`FIELD_CACHE_TTL_SECONDS=21600`）；命中只读盘，不打上游
- **风 / 气温 / 降雨**：仍 DEMO；`loadLive` 已留 OM 钩子

## `.env` 键名（值勿进仓）
```
EARTHDATA_TOKEN=
EARTHDATA_USERNAME=
EARTHDATA_PASSWORD=
CURRENT_SOURCE=auto          # auto|oscar|demo
FIELD_CACHE_DIR=.cache/fields
FIELD_CACHE_TTL_SECONDS=21600
OSCAR_SHORT_NAME=OSCAR_L4_OC_NRT_V2.0
OSCAR_COLLECTION_ID=C2102958977-POCLOUD
```
复制自 `.env.example`。无钥匙或 `CURRENT_SOURCE=demo` → 前端回退静态 DEMO，服务不崩。

## 命令
```bash
pnpm cache:status
pnpm cache:ocean          # 拉/刷新 global/ocean
pnpm cache:regional       # regional/currents
pnpm --filter @aether/web dev   # :8765，含 /api/fields
```

## HTTP
- `GET /api/fields/status`
- `GET /api/fields/global/ocean/meta.json`（miss 时确保刷新）
- `GET /api/fields/global/ocean/{u,v,mask}.bin`

## 预览
打开 http://localhost:8765/ → **全球**页 → 左下芯片点 **洋流**。页脚若走到 live，`meta.source=live`（控制台 `[aether] FieldFrame`）。
