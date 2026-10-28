---
version: light-repo-gate
name: AetherWatch-design
description: "墨蓝克制青 + Ventusky 天气图语法：地图铺满，左要素轨、右竖色阶、底时次轴。画布 #0a1628，强调 #5ac8e6。旧三栏指挥大屏作废。"
colors:
  canvas: "#0a1628"
  map: "#0b1a2e"
  surface-1: "#13243B"
  panel: "rgba(19,36,59,0.65)"
  panel-border: "rgba(90,200,230,0.12)"
  ink: "#e8f1f8"
  ink-muted: "#7a9bb5"
  ink-subtle: "#4a6a82"
  ink-warm: "#e5d9c4"
  primary: "#5ac8e6"
  primary-secondary: "#3a7a9e"
  on-primary: "#0a1628"
  wind-fog: "rgba(90,200,230,0.35)"
  semantic-ok: "#4ade80"
  semantic-warn: "#fbbf24"
  semantic-danger: "#f87171"
  map-veil: "rgba(10,22,40,0.9)"
typography:
  display:
    fontFamily: "Inter, SF Pro, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: 28px
    fontWeight: 600
  title:
    fontFamily: "Inter, SF Pro, PingFang SC, sans-serif"
    fontSize: 18px
    fontWeight: 600
  body:
    fontFamily: "Inter, SF Pro, PingFang SC, sans-serif"
    fontSize: 14px
    fontWeight: 400
  caption:
    fontFamily: "Inter, SF Pro, PingFang SC, sans-serif"
    fontSize: 12px
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 12px
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  pill: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
components:
  top-nav:
    height: 56px
    backgroundColor: "{colors.map-veil}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  glass-panel:
    backgroundColor: "{colors.panel}"
    border: "1px solid {colors.panel-border}"
    rounded: "{rounded.lg}"
---

# AetherWatch DESIGN.md（轻仓门禁 · 主 bot 必读）

> **壳层定稿**：墨蓝 `#0a1628` + 克制青 `#5ac8e6`。  
> **示意母版**：`/workspace/aetherwatch-ui/user-lock-v11/`（01全球 / 02预报台 / 03关于 / 04区域场）。  
> **废弃**：壳层 primary 电青 `#22d3ee`、画布 `#0c1118`、粒子硬顶 8k/20k（改为观感峰值 + LOD）。

## 1. Visual Theme

- 气质：天气图产品（Ventusky 语法）——地图铺满，壳贴边。
- 对标：https://www.ventusky.com/ 的界面结构（要素轨 / 竖色阶 / 底轴），**不刮**其天气瓦片、不复刻商标。
- 旧三栏 320|视口|320 指挥大屏与 `user-lock-v11` 大卡是反例。

## 2. Color Palette（严格执行）

| Token | Hex | 用途 |
|-------|-----|------|
| canvas | `#0a1628` | 全站底，禁纯黑 |
| map | `#0b1a2e` | 地图/地球底 |
| panel | `rgba(19,36,59,0.65)` | 玻璃面板 |
| panel-border | `rgba(90,200,230,0.12)` | 1px 细边 |
| primary | `#5ac8e6` | 选中 / 主按钮 / 高亮 / 图标描边 |
| primary-secondary | `#3a7a9e` | 弱线、未选中 |
| ink / muted / subtle | `#e8f1f8` / `#7a9bb5` / `#4a6a82` | 主/次/弱字 |
| wind-fog | `rgba(90,200,230,0.35)` | 风场雾丝带 |
| semantic-ok | `#4ade80` | 在线绿点 |

**禁止**：亮湖蓝 `#2196f3`、旧电青 `#22d3ee` 作壳层 primary、彩虹色标、紫粉糖果渐变。

## 3. 布局门禁

地图占满视口。壳是浮层，不预留 56px 顶栏或 320px 侧栏。

- 左上：Logo + 地点搜索 + 页链（全球/预报台/区域场/关于）+ 中/EN
- 左中：竖要素轨（风 / 洋流 / 气温 / 降雨）
- 右上：缩放 / 球·平 / 复位
- 右中：竖色阶（气温 50 在上、−40 在下）
- 底：播放钮 + 日期 + 时次轴（预报台 −24h…+24h，00h 选中）+ 包号
- 区域场：右下 NetCDF 双 CTA；全球/预报台无上传
- 关于：居中说明，不挡默认地图语法

### 全球
- 3D 地球 + 风雾；台风图标+虚线仅壳叠

### 预报台
- 平面全国窗；搜索飞城市，不换城包

### 区域场
- 洋流仅海面硬裁。细岸 A = OMT WGS84，不配高德 Key

### 关于
- 大标题 + 三入口 + CTA `#5ac8e6`

## 4. 场效果锁

| 场 | 锁版 | 说明 |
|----|------|------|
| 风场 | 雾感丝带 | 柔边半透，非硬线点阵 |
| 洋流 | B 宽水幕 | 仅水域；ocean mask / stencil |
| 气温 | A 热幕 | 冷青→克制暖奶油半透热幕 |
| 降雨 | C 积水斑 | 单色青积水斑，禁彩虹雷达 |

对照：`fx-options/temp-a-热幕.jpg`、`fx-options/rain-c-积水斑.jpg`

## 5. 粒子 / GPU 门禁（轻仓）

- **观感峰值**：全页 **30万–60万** GPU 粒子（用户口径；非 8k 硬顶）
- **LOD**：远景/静止可到峰值；**拖动、缩放、切 Tab** 必须降档或 pause，避免卡死
- 风场池与洋流池 **分池**，勿同屏双满载
- 切 Tab：**保留 canvas**，停 rAF / 卸离开页粒子；禁止整页拆球 + 同步 decode 整包

## 6. Logo / 图标

- Logo：罗盘/浪线圆标 + `AetherWatch`；描边跟 `#5ac8e6`
- 图标：1.5–2px 线性描边，开态青、默认主文字色；禁实心多色/渐变填色图标

## 7. Agent Prompt（贴给主 bot）

```
按 Ventusky 天气图语法做壳（地图铺满，勿三栏指挥大屏）：
- 画布 #0a1628，主强调 #5ac8e6（勿用 #22d3ee）
- 左要素轨 / 右竖色阶 / 底时次轴 / 左上搜索
- 粒子峰值30万–60万，拖动/切Tab LOD降档
- 风雾 / 洋流水幕仅海 / 气温热幕 / 降雨积水斑
- 上传仅区域；真源后置；不刮第三方瓦片
```

## 8. 验收顺序（产品）

1. 切 Tab 不卡死  
2. 三页布局门禁  
3. 四场效果  

真源后置；NC 上传 = P0（契约由数据架构出）。
