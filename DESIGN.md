---
version: light-repo-gate
name: AetherWatch-design
description: "v0.11 浅色白胶囊：色场铺满，1px #888 岸线，左彩点要素轨，右竖色阶，底黑播放钮。废弃深色三栏指挥大屏与深色 Ventusky 壳。"
colors:
  canvas: "#0b0f0c"
  chrome: "#ffffff"
  chrome-ink: "#111111"
  chrome-muted: "#6b7280"
  pill-on: "#111111"
  pill-on-ink: "#ffffff"
  dot-wind: "#3b82f6"
  dot-temp: "#f97316"
  dot-precip: "#2dd4bf"
  dot-ocean: "#7dd3fc"
  coast: "#888888"
  ink: "#111111"
  primary: "#111111"
  on-primary: "#ffffff"
  semantic-ok: "#22c55e"
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
rounded:
  lg: 28px
  pill: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
components:
  top-nav:
    height: 40px
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.chrome-ink}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
---

# AetherWatch DESIGN.md（v0.11 浅色白胶囊）

> **壳层定稿**：白胶囊浮在色场上。选中条 / 播放 / 缩放为黑圆。岸线 1px 浅灰 `#888`。城市注记带气温。  
> **废弃**：深色三栏指挥大屏、墨蓝 `#0a1628` + 克制青 `#5ac8e6` 的 Ventusky 克隆壳。  
> **仍禁止**：刮 Ventusky / Windy / 高德天气瓦片。场数据用自己的 FieldFrame。

## 1. Visual Theme

- 气质：浅色天气图产品。地图铺满，壳是白胶囊，不预留侧栏。
- 对标：仓库内 v0.11 四张锁版（全球气温 / 全球降雨 DEMO / 区域场空态 / 东亚风+台风）。
- 反例：旧 320|视口|320 指挥大屏；刚废弃的深色搜索条 + 青描边壳。

## 2. Color Palette

| Token | Hex | 用途 |
|-------|-----|------|
| chrome | `#ffffff` | 胶囊、卡片、日期 pill |
| chrome-ink | `#111111` | 字、选中条、播放钮、+/− |
| dot-wind / temp / precip / ocean | `#3b82f6` / `#f97316` / `#2dd4bf` / `#7dd3fc` | 左轨彩点 |
| coast | `#888888` | NE110m 1px 极细浅灰岸线 |
| semantic-ok | `#22c55e` | 「显示」绿点 |

**禁止**：壳层再用 `#5ac8e6` 作主色、深色玻璃顶栏、彩虹 UI 控件。

## 3. 布局门禁

地图占满视口。壳是浮层。

- 左上：一条白胶囊 `AetherWatch v0.11` + 全球 / 预报台 / 区域场 / 关于（选中黑 pill）
- 右上：白圆「中」/ 齿轮 / 「显示」绿点
- 左下（时次轴上方）：独立白胶囊要素钮（风蓝 / 气温橙 / 降雨青 / 洋流浅蓝），选中黑胶囊；各自一粒、不合成一块面板。另有圆形收起钮，收起后只留当前要素 + 展开。其上方 `2.0 m`（全球）或 `10.0 m`、图层、时次、导出；上传仅区域场
- 右中：竖色阶（气温 50…−40）
- 右下：黑圆 + / −
- 底：黑圆 ⏮ ▶ + 白胶囊「今天 · mm/dd」+ 白细轴与白旋钮
- 区域场空态：居中白卡「上传自己的 NC，当场见效果」，双 CTA「上传文件」「加载示例」；未上传不绑演示场
- 全球降雨：右上白胶囊 `DEMO·墨湾/印尼雨斑`
- 预报台：东亚窗 + 白虚线紫点台风轨（青岚 / 霜澜）

## 4. 场效果锁

| 场 | 锁版 |
|----|------|
| 气温 | 256×1 LINEAR LUT（≥15 节点）+ 场双线性，平滑热幕 alpha≈0.58；无粒子、无硬边色带 |
| 降雨 | 低周波 fbm 雨团：噪声调制 alpha 与 LUT 采样位；干区深蓝底 α=0.02；无粒子 |
| 风 | 水彩色幕 α=0.3 饱和度减半 + FBO 0.96 白荧光丝 `#FFFFFF`（寿命长，强风拉长、弱风隐）；每帧 0.08% 重生；粒子禁止染风速色 |
| 洋流 | 霜蓝色幕 × mask + 更细/更短/更慢/极稀的冷色 `#7FD4E8` 流线；FS mask=0 discard，不上陆 |

不刮第三方雷达 / 风场瓦片。Global 包必须 721×361 全球窗（O1）。

## 5. 粒子 / GPU

- 观感峰值 30万–60万；拖动 / 缩放 / 切 Tab 降档或 pause
- 粒子通道仅 wind / ocean。temp / precip 不跑 GPGPU、不 stamp。平流在 fragment 用经纬度采样 u10/v10，`pos += vel * dt`。风场拖尾是 FBO ping-pong ×0.96 荧光衰减；切 kind ≤200ms 淡入并清空上一层残影。
- 切 Tab 保留 canvas，禁止拆球

## 6. Agent Prompt

```
按 v0.11 浅色白胶囊做壳（不要深色 Ventusky 壳，不要三栏大屏）：
- 白 pill + 黑选中 / 黑播放 / 黑 +−
- 1px `#888` 浅灰岸线，城市名+气温
- 左下独立要素胶囊（可收起） / 右竖色阶 / 底时次轴
- 区域场空态居中双 CTA；未上传不绑场
- 台风白虚线+紫点（青岚/霜澜）
- 不刮第三方天气瓦片
```
