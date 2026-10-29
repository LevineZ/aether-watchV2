> Integrated into AetherWatch as **区域场** (`feat/ncview-lite`). See `INTEGRATION.md`.

# RomesView（离线 NetCDF 可视化）

离线桌面工具：打开 NC/NetCDF → 选变量 / 时间 / 高度 → 绘图 → 导出 PNG / 打印。  
灵感来自 [Panoply](https://www.giss.nasa.gov/tools/panoply/)，面向科研人员，无需写代码。

| 分支 | 说明 |
|------|------|
| **`full`** | 完整版，无试用限制，可长期使用 |
| **`trial`** | 试用版：首次打开起 **7 天**；到期需 **激活码** |

> **关于「防破解」**：激活码使用 **Ed25519 私钥签名**，客户端只有公钥，**无法自行伪造激活码**。  
> 离线软件无法做到「绝对无法破解」——有人逆向改程序仍可能绕过校验。本方案适合正常商务交付，不适合对抗专业破解。

---

## 界面一览

主界面（侧栏选文件 / 变量，右侧预览）：

![风场预览](docs/images/preview-wind.png)

温度等标量场（色块）：

![气温预览](docs/images/preview-temp.png)

### 风场 / 流场（一张图）

有 U/V（或 U10/V10）时自动合成：

- **风场**：色块 = 风速 \(\sqrt{U^2+V^2}\)，流线 = 方向  
- **流场**：色块 = 全流速，流线 = 流向（洋流「去向」）

风与洋流分开识别，不会混称。

---

## 最终用户怎么用（不需要安装 Python）

### macOS

1. 解压 `RomesView-macOS-arm64.zip`
2. 打开 `RomesView.app`（若提示无法验证：系统设置 → 隐私与安全性 → 仍要打开）

### Windows

1. 解压 `RomesView-Windows-x64.zip`（由 `trial`/`full` 分支在 Windows 上打包得到）
2. 双击 `RomesView.exe`  
   **整个文件夹都要保留**，不要只拷一个 exe。

试用版到期后：菜单 **授权 → 激活 / 查看机器码**，把机器码发给供应商，换取激活码后粘贴激活。

---

## 开发者：从源码运行

```bash
git clone https://gitee.com/zh17726055317/nc-view-offline-version.git
cd nc-view-offline-version
git checkout trial   # 或 full
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
python desktop.py
```

内置示例在侧栏 **内置示例…**（`sample-file/` 下的 WRF 文件）。

中文变量名可改 `data/var_labels.zh.json`，无需改代码。

---

## Windows 打包（给最终用户的 exe）

在 **已安装 Python** 的 Windows 上（推荐 3.12，安装时勾选 Add to PATH）：

```text
1. git clone 本仓库
2. git checkout full    （完整版）或  git checkout trial（试用版）
3. 双击 build_windows.bat
4. 成功后：dist\RomesView\RomesView.exe
5. 发给用户：dist\packages\RomesView-Windows-x64.zip
```

若双击 bat 出现一堆「不是内部或外部命令」：多为旧版 bat 编码问题，请重新拉取最新仓库后再试。  
也可在该目录打开「命令提示符」执行：`build_windows.bat`

详见 `WINDOWS_BUILD.txt`。用户收到 zip **不用装 Python**。

macOS 打包：

```bash
bash build_app.sh
# 产物：dist/RomesView.app 、 dist/packages/RomesView-macOS-arm64.zip
```

---

## 试用版：签发激活码（仅供应商）

私钥文件 `tools/license_private.pem` **不要提交、不要发给用户**。  
供应商本机保留私钥后：

```bash
# 查看用户发来的机器码，例如 491E0F25CC8C8D5FE832
python tools/gen_license.py --mid 491E0F25CC8C8D5FE832 --days 365
```

输出一行 `NCV1....` 发给用户即可。  
`--mid ANY` 可不绑定机器（仅依赖到期日，风险更高，慎用）。

---

## 目录结构（节选）

```text
desktop.py          桌面 UI（PySide6）
nccore.py           打开 NC / 绘图核心
licensekit/         试用与激活（trial 分支启用）
data/               海岸线 GeoJSON、中文变量名表
sample-file/        内置 WRF 示例
tools/gen_license.py  签发激活码
build_windows.bat   Windows 一键打包
ncview.spec         PyInstaller 配置
```

---

## 许可证与交付说明

商业交付请自行约定授权范围。完整版分支用于付费交付；试用版分支用于试用与激活转化。
