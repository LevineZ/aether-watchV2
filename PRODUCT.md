# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

要在笔记本或大屏上看全球/中国窗气象场的演示观众，以及要当场把自有 NC 铺上地图的分析人员。

## Product Purpose

AetherWatch 是全屏 Web 气象演示站。成功标准：全球·风满屏连续色幕+细白风丝；气温/降雨无白丝；预报台中国窗铺满；区域场上传 NC/JSON 后 bbox 内处处有效果。

## Positioning

同一套 FieldFrame → LUT 色幕 → GPGPU 粒子。全球/预报台用预生成开源静态包（GFS/ERA5），不依赖实时 API。区域场/NCView 在浏览器解析上传文件。视觉层硬锁 Ventusky 公开观感。

## Operating Context

本地 `pnpm --filter @aether/web dev`。页：`/global` `/desk` `/regional` `/about`。场：风 / 气温 / 降雨 / 洋流。预报台洋流灰显。

## Capabilities and Constraints

- 上传仅区域场；空态双 CTA（上传并演示 / 加载示例）。全球/预报台无上传。
- 顶栏只有四个场景；NCView 是区域场检视模式，不是第五 Tab。
- 台风图标+虚线只做壳叠。
- 气温 LUT −40…50。风丝全球×0.18、区域×0.09；N∝1/zoom²。气温/降雨粒子 paused。
- 全球降雨 DEMO 雨斑：墨湾 / 印尼。预报台角标「示例数据」。
- 不刮第三方天气瓦片。底图 Carto Dark Matter。

## Brand Commitments

- 名：AetherWatch。
- 用户钉死的视觉：Ventusky 底图质感、色幕连续性、风场粒子气质。v0.11 浅色白胶囊是反例。
- 壳色：深灰半透明面板，灰白字，强调青 `#3ec6c8`。白 pill 仅用于单击读数。

## Evidence on Hand

- `public/demo/{global,china,regional}` 静态 FieldFrame。
- 色表锁在 `packages/particles/src/lut.ts`。
- 无 Ventusky 天气瓦片、无高德 Key、无实况雷达。

## Product Principles

1. 图是产品，壳贴边。
2. 场绑定 fail-closed：全球缺包就灰，不回落邮票。
3. 演示标明 DEMO / 示例数据。
4. 不刮天气瓦片。
5. 先保证全球·风满屏成立，再铺其余 kind 与场景。
