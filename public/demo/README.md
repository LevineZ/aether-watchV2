# Demo 静态包格式（唯一）

每个子目录一份场：

- `meta.json`
- `u.bin` / `v.bin`：Float32 little-endian，长度 `nx*ny`
- 行主序 **south → north**，列 west → east
- 可选 `scalar.bin`（同形状 f32）；`mask.bin` **仅 ocean**（Uint8，1=海洋，0=陆地）。temp/precip/wind 禁 maskFile。

禁止把私有 JSON 直接喂给粒子层。前端只认 FieldFrame。

| 包 | 用途 |
|----|------|
| global/wind | 全球风雾 ~0.5°（721×361），全地球窗 |
| global/ocean | 全球洋流 ~0.5° + 硬海 mask；禁绑区域 141×131 |
| global/temp | 全球气温热幕 scalar，禁 maskFile |
| global/precip | 全球降雨积水斑 scalar，禁 maskFile |
| china/wind | 预报台全国风 ≥0.25°（249×145） |
| china/temp | 预报台全国气温 scalar |
| china/precip | 预报台全国降雨 scalar |
| regional/currents | 区域场洋流：OSCAR 1/3° 气候态重采样 + 硬海洋 mask（示例数据） |
| regional/temp | 区域气温热幕 scalar |
| regional/precip | 区域降雨积水斑 scalar |
| sample-currents.nc | NetCDF-3 上传试验（变量 uo/vo） |

区域底图 `public/basemap/regional/firefly.pmtiles`（gitignore，演示机私有缓存）锁 Firefly 窗 `[116.5,21,132.5,36]`，仅 `/regional` 使用。
