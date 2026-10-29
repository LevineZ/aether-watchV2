# AetherWatch 演示轻仓 · 数据契约 v1

状态：产品+UI 已锁；现仓冻结；另开轻仓。  
验收序：① Tab 不卡死 → ② 布局门禁 → ③ 四场效果。真源后置。

## 1. 统一场形状（唯一交换格式）

所有 loader（demo / live / upload-nc）只产出：

```ts
type FieldKind = 'wind' | 'ocean' | 'temp' | 'precip'

type FieldFrame = {
  nx: number
  ny: number
  bbox: [west, south, east, north] // deg；粒子 world→UV 只认这份窗，随相机只重绑投影矩阵
  time?: string // ISO
  u: Float32Array // length nx*ny, row-major, south→north or documented
  v: Float32Array
  kind?: FieldKind      // 样式由 kind 决定，禁止一套青点换标签
  scalar?: Float32Array // temp / precip 热幕·积水斑
  mask?: Uint8Array    // 仅 ocean：1=海/0=陆。temp|precip|wind 禁止带 mask
  meta: {
    source: 'demo' | 'live' | 'upload'
    vars: string[]
    units: string
    fill?: number
  }
}
```

前端：`FieldFrame` → GPU 纹理（RG=UV 或 R=scalar）→ 粒子 / 色幕。  
**禁止**前端直读各源私有 JSON 形状。

## 2. Loader 边界

| id | 何时 | 行为 |
|----|------|------|
| `demo` | 演示默认 | 读 `public/demo/**` 静态包；保证三页有流动 |
| `live` | 四要素 | 洋流 OSCAR + 风/气温/降雨 Open-Meteo → `.cache/fields`（TTL≈6h）→ 同 FieldFrame；失败回退 demo |
| `upload-nc` | 区域场 P0 | 用户 NC → Worker 解析 → FieldFrame |

出处：页脚「示例 · 单帧」+ `meta.source=demo`。顶栏不放「示例数据」角标。  
**mask 契约**：仅 `kind=ocean` 允许硬海 mask；`loadDemo` / `bindToGpu` 对 temp|precip|wind **强制丢 mask**。包侧这三类禁 `maskFile`。

## 3. 静态 DEMO 包布局

```
public/demo/
  global/wind|ocean|temp|precip/   # 全球窗 ~721×361 / 0.5°；禁绑 regional 141×131
  china/wind|temp|precip/          # 区域风等备用；预报台相机窗改绑 global/* 铺满视口
  regional/currents|temp|precip/   # 东海窗；岸线/DEM 走底图 PMTiles，不进 FieldFrame
```

每包至少：`meta.json` + `frame-000.bin`（f32 interleaved 或分文件 u.bin/v.bin，README 写死一种）。

## 4. 区域场 NC 上传（P0）

- 入口：区域场右下渲染浮窗；拖放 / 选择 `.nc`
- 解析：Web Worker；NetCDF-4 优先 `@earthyscience/netcdf4-wasm` / h5wasm；NetCDF-3 可用 netcdfjs
- 变量映射（可配置）：`u|ugrd|uo` × `v|vgrd|vo`；气温 `t|temp|t2m`；降水 `tp|precip|rain`
- 坐标：识别 `lon/lat` 或 `longitude/latitude`；超限裁剪到当前区域 bbox
- 失败：明确报错（格式/缺变量/过大），不卡死主线程
- 演示：无文件时仍用 `demo` 静态包冒充流动；上传成功则 `source=upload`

体积建议：演示期单文件 ≤100MB；超限提示压缩/裁区。

## 5. 粒子与性能门禁

- 全页峰值：**2万–3万**（屏上风粒子；webgl-wind / MapLibre CustomLayer）
- LOD：空闲 **peak=3 万**；拖动停平流、计数不砍；**松手必须回 peak 并重投**。禁止卡在 interact/8k。
- 全球风场与区域场洋流 **分池**，勿同屏叠满两套峰值
- 切 Tab：**保留 Map/canvas**，停粒子；禁止整页拆球 + 同步 decode 整包

## 6. 四场效果 ↔ 数据

| 效果 | 页 | 数据 |
|------|----|------|
| 风速流线 | 三页芯片；默认全球/预报台 | UV，**无 mask**；丝带按风速着色 |
| 洋流水幕（仅海） | 三页芯片；默认区域场 | UV + **硬海洋 mask**（岸线可软 2–4px） |
| 气温热幕 | 三页芯片 | scalar 全 bbox，**禁 mask**；无粒子 |
| 降雨雨丝 | 三页芯片 | scalar 湿幕 + 下落雨丝（湿区），**禁 mask** |

色：壳白胶囊 `#ffffff` / 选中与播放 `#111111`；禁把第三方天气瓦片当色标。

## 7. 轻仓目录（建议）

```
aether-demo-shell/
  apps/web/                 # Vue3+Vite+MapLibre
  packages/field/           # loaders: demo | live stub | upload-nc
  packages/particles/       # GPU layer + LOD
  public/demo/              # 静态包
  DATA-CONTRACT.md          # 本文
```

无 Redis、无多源预热、无策略 B。现仓 `aether-watch` 冻结。

## 8. 开干验收（数据侧）

- [ ] 三页默认 `demo` 均有流动；页脚「示例 · 单帧」，顶栏无「示例数据」角标
- [ ] 切 Tab 无 Long Task 卡死（pause 粒子 + 不拆 Map）
- [ ] 静止粒子锁 2–3 万；拖动降档可恢复
- [ ] 区域场可上传 NC → 同粒子/色幕通路；失败不崩
- [x] `live` 洋流走 `/api/fields` 落盘缓存；无钥匙回退 demo；签名与 demo 相同

## 9. 落盘缓存（lite）

- 目录：`FIELD_CACHE_DIR`（默认 `.cache/fields/{packId}/`，gitignore）
- 形状：与 DEMO 相同 `meta.json` + `u.bin`/`v.bin`/`mask.bin`（仅 ocean）
- TTL：`FIELD_CACHE_TTL_SECONDS` 默认 **21600（6h）**；并发打缓存不打上游
- 环境变量（密钥勿进仓）：`EARTHDATA_TOKEN` 或 `EARTHDATA_USERNAME`+`EARTHDATA_PASSWORD`，`CURRENT_SOURCE=auto|oscar|demo`
- HTTP：`GET /api/fields/status`；`GET /api/fields/{packId}/meta.json`（miss 时确保刷新）；bins 同路径
- 无钥匙 / 上游失败：前端 `loadLive` 回退 `loadDemo`，演示不崩
