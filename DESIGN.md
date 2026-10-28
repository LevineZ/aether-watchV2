---
version: ventusky-lock
name: AetherWatch-design
description: "Ventusky 公开观感硬锁：暗色细岸底图、灰度场+前端 LUT 色幕、GPGPU 白青风丝。壳从底图暗气质派生，禁止自创视觉世界覆盖色幕连续性与粒子气质。"
colors:
  canvas: "#0d0d0d"
  chrome: "rgba(16,16,18,0.82)"
  chrome-ink: "#e8eaed"
  chrome-muted: "#9aa0a6"
  pill-on: "#3ec6c8"
  pill-on-ink: "#081314"
  primary: "#3ec6c8"
  on-primary: "#081314"
  land: "#1a1a1a"
  ocean: "#0d0d0d"
  coast: "#9aa0a6"
  particle: "#E8F4F8"
typography:
  body:
    fontFamily: "Inter, SF Pro, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: 14px
    fontWeight: 400
rounded:
  lg: 20px
  pill: 9999px
---

# AetherWatch DESIGN.md（Ventusky lock）

> **视觉层**：对标 Ventusky 公开观感。底图暗、色幕连续、风丝细白。  
> **反例**：v0.11 浅色白胶囊、鲜艳矢量填充、卫星影像、粗边界、霓虹粒子、自创玻璃拟态。  
> **仍禁止**：刮 Ventusky / Windy / 高德 *天气* 瓦片。场数据只用 FieldFrame。

## 1. Visual Theme

- 气质：暗色天气图。地图铺满，壳是深灰半透明胶囊，不预留侧栏。
- 底图：Carto Dark Matter `dark_nolabels`（陆地 #1a1a1a–#222，海洋 #0d0d0d–#111，细浅岸线）。瓦片自带岸线，不再叠自绘岸线。
- 强调色：中性青 `#3ec6c8`。禁止额外光晕、渐变边框、玻璃拟态。

## 2. 色幕（灰度场 + 256×1 LUT）

标量先归一化进单通道，fragment 采样 LUT。整体 alpha 0.45–0.65。

| 场 | 物理窗 | 备注 |
|----|--------|------|
| 气温 | −40…50 °C | 锁死节点，线性插值 |
| 风速 | 0…50 m/s | \|UV\| |
| 降雨 | 0…50 mm | 干区 alpha 0.02–0.05，禁止整片全透明 |
| 洋流 | 0…2 m/s | mask=0 陆地完全透明 |

气温/降雨：粒子 paused，渲染 alpha=0，不许白丝。

## 3. 风场粒子

- GPGPU 双缓冲。全球速度系数 0.18，区域 0.09。
- N ≈ 360k / zoom²，峰值夹 400k。
- 颜色 `#E8F4F8`，拖尾随风速变长。每帧随机重置 1%–3%。
- 屏空间 LINEAR 拖影，fade≈0.995。

## 4. 布局

- 顶栏四场景：全球 · 预报台 · 区域场 · 关于。禁止第五个。
- 左：要素芯片 风/气温/降雨/洋流；时次/高度无维时灰显「本包无时次」。
- 上传仅区域场/NCView。全球/预报台无「上传」字样。
- 预报台：中国窗 lon 73–135, lat 18–54；底时间轴更粗；角标「示例数据」；洋流灰显。
- 区域场空态：中央卡，实心青「上传并演示」+ 幽灵「加载示例」。
- 单击读数：白 pill；缺测不编数。
- 台风：past `#b44dff` / now `#ff2d3d` / fcst `#3ec6ff`。

## 5. Agent Prompt

```
按 Ventusky 公开观感做气象演示站（不要 v0.11 白胶囊，不要自创霓虹）：
- 暗色细岸底图 + LUT 半透色幕 + 细白 GPGPU 风丝
- 四场景：全球 / 预报台 / 区域场 / 关于
- 上传只在区域场；预报台中国窗、洋流灰显
- FieldFrame lat 升序、lon −180–180
- 不刮第三方天气瓦片
```
