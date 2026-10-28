# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

预报员、会商主持人、以及要在大屏或笔记本上看全球/全国/近海场的演示观众。场景是打开一张会动的天气海洋图，立刻切换要素和窗口，而不是填一张指挥大屏仪表。

## Product Purpose

AetherWatch 是 Vue3 + MapLibre 演示壳：用 FieldFrame 把风、洋流、气温、降雨铺在同一张底图上。成功标准是三页可切、四场可读、区域能换本地 NetCDF，全球窗永不误绑区域邮票。

## Positioning

同一套 GPU 粒子/色幕，按页绑定不同 DEMO 包；全球包必须 ~721×361 全世界窗（O1）。洋流只画海（mask 0–255）。不刮第三方天气瓦片、不把高德 Key 写进仓。

## Operating Context

本地 `pnpm --filter @aether/web dev`。页：`/global` `/desk` `/regional` `/about`。场：风 / 洋流 / 气温 / 降雨。预报台时间轴为示意 −24h…+24h、00h 选中，单帧不切时次。

## Capabilities and Constraints

- 上传仅区域场；空态双 CTA（选择文件 + 试用示例 NC）。全球/预报台无上传。
- 顶栏不出现 NC View；不出现「模式·自动」。
- 台风图标+虚线只做壳叠，不是场包。
- 气温色阶 50→−40。风丝全球×0.18、预报台/区域×0.09；n∝1/zoom² 仅风丝。气温/降雨粒子关。
- 区域细岸 A = OpenMapTiles WGS84，不配高德 Key。
- 全球降雨 DEMO 雨斑：墨湾 / 印尼，带 DEMO 角标。
- 风幕同包 |UV| 分位自适应，禁止固定 /24。不做 O4。

## Brand Commitments

- 名：AetherWatch。
- 用户钉死的壳语法：按 https://www.ventusky.com/ 的天气图产品做——地图铺满、左侧要素轨、右侧竖色阶、底轴时次。旧三栏 320|视口|320 指挥大屏是反例，不是母版。
- 画布墨蓝 `#0a1628`、强调青 `#5ac8e6` 仍是自家色，不抄观潮霓虹绿，不把 Ventusky 的瓦片或商标带进仓。
- 下列为仓库推断、未单独访谈确认：主用户是会商/演示观众；无无障碍专项标准。

## Evidence on Hand

- `public/demo/{global,china,regional}` 静态 FieldFrame。
- `docs/screenshots/` 为验收截图。
- 无 Ventusky 瓦片、无高德 Key、无实况雷达。

## Product Principles

1. 图是产品，壳贴边，不和地图抢面积。
2. 场绑定 fail-closed：全球缺包就灰，不回落邮票。
3. 演示必须标明 DEMO；真源后置。
4. 不刮、不配第三方地图 Key。
5. 能切页、切要素、在区域换 NC，比堆指标卡更重要。
