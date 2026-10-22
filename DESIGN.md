---
version: light-repo-gate
name: AetherWatch-design
description: "定稿「墨蓝克制青」：画布 #0a1628 + 壳层强调 #5ac8e6。母版 user-lock-v11/。粒子观感峰值 30万–60万（GPU），拖动/切Tab LOD 降档。区别于观潮霓虹绿；禁旧电青 #22d3ee 作壳层 primary。"
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

- 气质：气象指挥大屏 / 暗色精密壳；控件玻璃浮层。
- 对标观感差异：可对标 earth.nullschool / 观潮的「流动感」，**不抄**其霓虹绿整页皮肤与接口。
- 三页节奏与 `user-lock-v11` 一致。

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

### 全球
- 顶栏 56px：Logo + 四 Tab（全球/预报台/区域场/关于）+ 中/EN / 示例数据
- 左≈320：四指标 + 迷你趋势 + **青单色**风速图例（禁彩虹）
- 中：3D 地球 + **风雾**流动
- 右≈320：视图控制 / 快速导航 / 数据信息（真源位可占位）
- 底≈100：时间轴可播 + 快捷时段 + 下载数据

### 预报台
- 左：城市列表高亮；中：陆域风雾流线；右：图层面板；底：-24h~+24h，00h 选中
- 面板语言与区域场一致

### 区域场（质感标杆）
- 洋流 **B 宽水幕/漩涡**，**仅海面硬裁**（陆地零纹理）
- 左上 320km 雷达环探测卡；右下渲染浮窗（滑块 + 弱→强青条）
- 预留 **NC 上传**入口（演示可用静态包冒充流动）

### 关于
- 大标题 + 三入口卡 + 底数据源条 + CTA `#5ac8e6`（勿过曝发光）

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
按 /workspace/aetherwatch-ui/DESIGN.md + user-lock-v11/ 做轻仓壳：
- 画布 #0a1628，主强调 #5ac8e6（勿用 #22d3ee）
- 全球三栏320|视口|320 + 底轴100；预报台/区域场按锁稿
- 粒子峰值30万–60万，拖动/切Tab LOD降档；Tab不卡死优先
- 风雾 / 洋流水幕仅海 / 气温热幕 / 降雨积水斑
- 预留NC上传；真源后置
- 勿抄观潮霓虹绿；勿彩虹色标
```

## 8. 验收顺序（产品）

1. 切 Tab 不卡死  
2. 三页布局门禁  
3. 四场效果  

真源后置；NC 上传 = P0（契约由数据架构出）。
