# AetherWatch 演示轻仓（aether-demo-shell）

墨蓝壳层 `#0a1628` + 克制青 `#5ac8e6` 的三页演示：全球风雾 / 预报台 / 区域场洋流。  
**FieldFrame 是唯一场交换形状**。默认读 `public/demo/**` 静态包，角标固定为「示例数据」。无 Redis、无实况上游。

设计与契约见仓库根目录 [`DESIGN.md`](./DESIGN.md)、[`DATA-CONTRACT.md`](./DATA-CONTRACT.md)。

## 一键运行（推荐）

```bash
docker compose up --build
```

浏览器打开 `http://<主机>:8765`。健康检查：

```bash
curl -s http://127.0.0.1:8765/health
# {"status":"ok","service":"aether-demo-shell"}
```

停止：`docker compose down`。

## 本地无 Docker

需要 Node 20+ 与 pnpm：

```bash
corepack enable
pnpm install
pnpm preview
# 或开发：pnpm dev   （同样监听 8765，含 /health）
```

`pnpm preview` = 生成 demo 包 + Vite 构建 + `apps/web/server.mjs` 服务于 **8765**。

底图：`/global` 与 `/desk` 用轻量矢量（岸线/国界）+ 分级中文注记（远 11–12 / 近 13–14，`#c8d6e5`，描边 `#0a1628` 60%）。**仅 `/regional`** 叠 Esri World Imagery Firefly 本地 PMTiles（`public/basemap/regional/firefly.pmtiles`，窗 `[116.5,21,132.5,36]`，z5–10，maxBounds 锁窗）+ 墨蓝半透蒙版 `#0a1628`。禁止整站白天真彩。地名在 map style，不进 FieldFrame。粒子默认密度 0.48，注记压在场上并碰撞避让。

Firefly **ToS**：批量离线烘焙进仓或公网分发可能违 Esri 条款。`firefly.pmtiles` **不进可分发仓**（gitignore），由演示机 `pnpm generate` 私有缓存；运维叠路径 `/opt/aether-demo-shell/public/basemap/regional/firefly.pmtiles`。生产若直连瓦片，用环境变量 `VITE_ESRI_API_KEY`（密钥不进仓）。归因：Esri, Maxar, Earthstar Geographics 等。

## 腾讯云轻量应用服务器（Ubuntu 22.04）

以一台干净的 Lighthouse Ubuntu 22.04 为例。

1. **安装 Docker 与 Compose 插件**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
# 重新登录后再执行后续命令
```

2. **拉代码并启动**

```bash
git clone <本仓库> aether-demo-shell
cd aether-demo-shell
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8765/health
```

3. **放行端口**

- 控制台 → 防火墙 / 安全组 → 入站放行 **TCP 8765**。
- 本机如开了 ufw：`sudo ufw allow 8765/tcp && sudo ufw reload`。

4. 访问 `http://<公网IP>:8765`。

容器只暴露 Web（含 `/health`），**不包含 Redis、数据库或多源预热**。

## 路由

| 路径 | 页 |
|------|----|
| `/global` | 全球 · 风雾丝带 |
| `/desk`（`/forecast` 别名） | 预报台 · 全国风雾 |
| `/regional` | 区域场 · 洋流水幕（仅海）+ 暗色卫星底图 |
| `/about` | 关于 |

切 Tab **保留 Map/canvas**，先 pause 粒子再换场纹理；禁止拆球 + 主线程同步 decode。拖动停平流但计数保持峰值；松手回到约 40 万 GPU 粒子并按当前相机重投。气温/降雨切 overlay 面（关粒子丝带）。

## Demo 包格式（唯一）

`public/demo/<包>/`：

- `meta.json`
- `u.bin` / `v.bin`：Float32 **little-endian**，长度 `nx*ny`，行主序 **south → north**
- 可选 `scalar.bin`（f32）、`mask.bin`（Uint8，1=海洋/有效）

前端禁止直读各源私有 JSON。NC 上传走 Web Worker，变量映射 `u|ugrd|uo` × `v|vgrd|vo`；NetCDF-4/HDF5 会明确报错（需转 classic）。示例文件：`/demo/sample-currents.nc`。

重新生成静态包：`pnpm generate`。

## 目录

```
apps/web/              Vue3 + Vite + MapLibre
packages/field/        loadDemo / loadLive(stub) / parseNcFile
packages/particles/    GPU 粒子层 + LOD
public/demo/           静态场包
```

`loadLive` 仅占位，签名与 `loadDemo` 相同，不请求 OM/OSCAR。

来源 tip：[`b05163ac823d45a766a6dc730b9db87ae1d07bb7`](./SOURCE_TIP.txt)（见 `SOURCE_TIP.txt`）。
