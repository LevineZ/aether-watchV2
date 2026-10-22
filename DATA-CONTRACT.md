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
  mask?: Uint8Array    // 1=ocean/valid, 0=land/invalid；陆地 u/v=NaN
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
| `live` | 后置 | OM / OSCAR / CMEMS → 同 FieldFrame；只换实现 |
| `upload-nc` | 区域场 P0 | 用户 NC → Worker 解析 → FieldFrame |

角标文案固定：**示例数据**（不说实况）。

## 3. 静态 DEMO 包布局

```
public/demo/
  global/wind/          # 全球风雾
  forecast/china/       # 预报台全国（可复用现仓 china 合同 72×40）
  forecast/{city}/      # 可选城包，先点选不自动切
  regional/currents/    # 区域场洋流（仅海面 mask）
  regional/temp/        # 气温热幕 scalar
  regional/precip/      # 降雨积水斑 scalar
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

- 全页峰值：**30万–60万**（GPU 驻留；webgl-wind / MapLibre CustomLayer）
- LOD：空闲 **peak≈40 万**；拖动停平流、计数不砍；**松手必须回 peak 并重投**。禁止卡在 interact/8k。
- 全球风场与区域场洋流 **分池**，勿同屏叠满两套峰值
- 切 Tab：**保留 Map/canvas**，停粒子；禁止整页拆球 + 同步 decode 整包

## 6. 四场效果 ↔ 数据

| 效果 | 页 | 数据 |
|------|----|------|
| 风雾丝带 | 全球 / 预报台 | UV + 可选 mask |
| 洋流水幕（仅海） | 区域场 | UV + **硬海洋 mask** |
| 气温热幕 | 区域场/预报 | scalar 温度 |
| 降雨积水斑 | 区域场 | scalar 降水（软斑渲染偏 UI） |

色：壳 `#0a1628` / 强调 `#5ac8e6`；禁彩虹色标（UI 锁）。

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

- [ ] 三页默认 `demo` 均有流动，角标「示例数据」
- [ ] 切 Tab 无 Long Task 卡死（pause 粒子 + 不拆 Map）
- [ ] 静止粒子可达 30万+；拖动降档可恢复
- [ ] 区域场可上传 NC → 同粒子/色幕通路；失败不崩
- [ ] `live` 仅 stub，接口签名与 demo 相同
