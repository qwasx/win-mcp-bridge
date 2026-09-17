<div align="center">

# win-mcp-bridge

**让 AI 完全操控你的 Windows 电脑 —— 屏幕上不会闪过任何黑窗口。**

*Give an AI agent full remote control of a Windows PC — with zero console windows flashing on screen.*

[English](README.en.md) · **简体中文**

![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4)
![python](https://img.shields.io/badge/python-3.11%2B-3776ab)

</div>

---

## 这是什么

一套把 Windows 电脑"交给 AI 远程操控"的**生产级部署层**。

底层的桌面自动化用的是 [Windows-MCP](https://github.com/CursorTouch/Windows-MCP)，这个项目解决的是**让它在真实机器上长期稳定、安静、安全地跑起来**的所有问题。

装好之后，你在任何支持 MCP 的 AI 里说一句话，它就能截图、点击、打字、跑命令、读写文件 —— 而你的屏幕上**什么都不会闪**。

> 这些代码全部跑在一台真实的日常主力机上。里面每一个修复，都是因为真的出过问题。
> 就算你不用这套代码，**[十条踩坑经验](#十条踩坑经验)** 那节也值得一读。

---

## 能得到什么

| | |
|---|---|
| 🖥️ **24 个桌面工具** | 截图、点击、键盘、UI 树、PowerShell、注册表、全盘读写 |
| 📁 **7 个文件工具** | 读写文件、执行命令 |
| 🔇 **零窗口** | 没有托盘图标、没有控制台、**操控时不闪黑窗**（[怎么做到的](#1-控制台闪窗)） |
| ♻️ **自愈** | 任何组件挂掉，15 秒内自动拉起 |
| 📦 **可移植** | 没有硬编码路径和用户名，放哪个文件夹都能跑 |
| 🖧 **多机管理** | 一份清单管多台电脑，身份互不串台 |
| 💾 **离线安装** | 自带 Python，**目标电脑什么都不用预装** |

---

## 架构

```
        公网
         │
   Cloudflare 隧道              每台电脑一条独立隧道（原因见下）
         │
  ┌──────┴───────┐
  │ cloudflared  │
  └──────┬───────┘
         │  按路径分流
   ┌─────┴──────┐
   │            │
/desktop/mcp   /mcp
   │            │
  :8010        :8000
windows-mcp   bridge_server.py
（桌面操控）   （文件 + 命令）
   │            │
   └─────┬──────┘
         │
   supervisor.py      看门狗：进程死了就拉起，
                      用 127.0.0.1:8021 做单例锁
```

---

## 需要什么

- Windows 10 / 11，**64 位**
- 一个 Cloudflare 账号 + 一个域名（免费版够用）
- **没了。安装包自带 Python。**

---

## 快速开始

```cmd
git clone https://github.com/<你>/win-mcp-bridge
cd win-mcp-bridge\setup
:: 右键 install.cmd → 以管理员身份运行
install.cmd --id pc1
```

> **管理员权限只在一个地方需要**：注册开机自启任务。
> 不想给也行，装完手动双击 `launch.cmd` 启动即可。

安装器会自动完成：

1. 解压一个私有 Python（约 11MB，**不写注册表、不改 PATH、不污染系统**）
2. 装 `windows-mcp` 和依赖（有离线包就离线装）
3. 重新打上 `patches/` 里的补丁
4. 跑 `cloudflared tunnel login` → **你在浏览器点一次 Authorize**
5. 给**这台机器**建它自己的隧道和域名
6. 生成 `machine.json`，里面是随机生成的 token
7. 注册开机任务并启动

最后会打印一段 JSON，贴进你的机器清单就完事了。

### 日常使用

```cmd
launch.cmd            :: 启动（幂等，已在跑不会重复起）
launch.cmd status     :: 看状态
launch.cmd stop       :: 全停
launch.cmd restart    :: 重启
```

---

## 客户端怎么连

```python
import httpx2                      # 注意：是 httpx2 不是 httpx，mcp 2.x 用的是它
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

URL   = "https://pc1.example.com/desktop/mcp"
TOKEN = "<machine.json 里的 desktop_token>"

http_client = httpx2.AsyncClient(
    headers={"Authorization": f"Bearer {TOKEN}"},
    timeout=httpx2.Timeout(connect=30, read=180, write=60, pool=30),
    transport=httpx2.AsyncHTTPTransport(retries=5),
)
async with http_client as hc:
    async with streamable_http_client(URL, http_client=hc) as (r, w, *_):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
```

**`read` 超时一定要给到 180 秒** —— 截图可能有几百 KB，短了会断。

多机用法看 [`examples/fleet.py`](examples/fleet.py)。

---

## 多机管理

**每台电脑必须有自己的隧道。** 这不是设计洁癖，是硬性要求：

Cloudflare 把共用同一个隧道 ID 的两个 `cloudflared` 当成**副本**，请求会被**随机**发给其中一台（[官方文档](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/deploy-replicas/)）。

对远程操控来说这是灾难级的：**你的截图来自 A 机，紧接着那一下点击落在了 B 机上。**

所以身份被彻底拆出代码：

```
仓库 / 安装包（可复制）        machine.json（一机一份，已 gitignore）
──────────────────────        ──────────────────────────────────────
supervisor.py                 machine_id, label
bridge_server.py              hostname        ← 自己的域名
launch.cmd                    bridge_token    ← 自己的密钥
patches/                      desktop_token
                              bound_computer  ← 防串台保险
```

`bound_computer` 是最后一道保险：如果你整个文件夹拷到另一台机器，supervisor 发现机器名对不上，会**拒绝启动隧道**并在日志里写明怎么修，本地端口照常可用。

客户端这边，上面这些复杂度全部消失：

```python
await fleet_status()                  # 所有机器，一张表
await run_on("office", "ps", "...")   # 指定一台
await run_on_all("ps", "...")         # 广播到所有
```

---

## 十条踩坑经验

**这部分才是这个仓库最值钱的地方。** 每一条都实打实耗过调试时间。

### 1. 控制台闪窗

**现象**：每次调 PowerShell 工具，屏幕闪一下黑窗口。快到截图根本抓不住。

**根因**：在 `windows_mcp/powershell/utils.py` 里 —— 所有 PowerShell 调用的必经之路：

```python
creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP   # 只有这一个
```

`CREATE_NEW_PROCESS_GROUP` 是为了能发 `CTRL_BREAK_EVENT` 优雅停止，必须留着。但它**不阻止 Windows 给子进程分配控制台**。

**修复**（见 [`patches/`](patches/)）：

```python
creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP
creationflags |= getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

if kwargs.get("startupinfo") is None:          # 双保险
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = 0                          # SW_HIDE
    kwargs["startupinfo"] = si
```

> **关键知识点**：`CREATE_NO_WINDOW` 和 `CREATE_NEW_PROCESS_GROUP` **可以共存**，只有 `DETACHED_PROCESS` 才互斥。优雅停止的能力不会丢。

**怎么验证才算数**：肉眼看没用，闪窗只有约 50 毫秒。正确做法是一边猛打命令，一边高频扫描窗口：

```
每 50 毫秒 EnumWindows 一次，持续 12 秒
匹配 ConsoleWindowClass + CASCADIA_HOSTING_WINDOW_CLASS
同时并发打 12 条命令（PowerShell / cmd / python）
→ NO_CONSOLE_WINDOW_EVER_APPEARED
```

脚本见 [`examples/verify_no_console_flash.py`](examples/verify_no_console_flash.py)。

> ⚠️ 升级或重装 `windows-mcp` 会覆盖这个补丁，**记得重新打**。

### 2. embeddable 版 Python 没有 venv 模块

```
C:\python\python.exe: No module named venv
```

Python 官方的 embeddable 发行版**不带 `venv`**。任何写了 `python -m venv` 的安装脚本，在新电脑上必然失败。

解决：直接把包装进那个解释器。已端到端验证（服务能起、能响应 MCP、补丁生效）。

### 3. `python3xx._pth` 里的 `#import site`

embeddable 版默认把 site 导入**注释掉了**。不改这一行，`pip` 装的包会**静默地 import 不到**。安装器会自动改写：

```
#import site   →   import site
```

### 4. 绝对不要让启动器去触发自己的计划任务

**这一条把整个桥搞挂过。**

计划任务跑 `launch.cmd`，而 `launch.cmd` 的启动分支里写了 `schtasks /run /tn "MCP-Stack"`。任务 → 脚本 → 任务，无限自套。supervisor 从没被拉起来，两个端点全返回 HTTP 530。

**但更该检讨的是验证方法。** 改完之后连验三次都显示 "UP" —— 因为**老的 supervisor 进程还活着**，把新链路的错误完全掩盖了。端口通不等于链路对。

> **铁律：改完启动链路，必须杀干净所有进程，走真实路径冷启动验证。**
> 否则你测的是旧进程。

### 5. 单例锁：绑端口，别用 PID 文件

重复启动很容易发生，又很难发现。PID 文件在进程被 kill 时会变成过期锁，而绑定的 socket 由内核自动释放：

```python
SINGLETON_PORT = 8021
s.bind(("127.0.0.1", SINGLETON_PORT))   # 第二个实例绑不上 → 自己退出
```

### 6. `pythonw.exe` 在进程列表里会显示两个

用 `pythonw.exe` 跑的脚本，会出现**命令行完全相同的父子两个进程**。两行是正常的。只统计父进程不在集合内的：

```powershell
$all = @(Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'supervisor\.py' })
$ids = $all.ProcessId
@($all | ? { $ids -notcontains $_.ParentProcessId }).Count   # → 1
```

或者干脆看 8000/8010 的 listener 数量。

### 7. 验证解释器要真的 import，不能只看文件在不在

路径存在，完全不代表它的依赖装全了：

```python
subprocess.run([exe, "-c", "import mcp,uvicorn,starlette"], timeout=25,
               creationflags=CREATE_NO_WINDOW).returncode == 0
```

### 8. Cloudflare 会缓冲 SSE

大响应（截图 200KB～900KB）会**偶发被拦腰截断** —— HTTP 200，但包不完整。强制走普通 JSON 就好了：

```
FASTMCP_JSON_RESPONSE=1
```

### 9. cloudflared 不剥路径前缀

匹配 `^/desktop` 的 ingress 规则，转发时**原样保留路径**。所以后端必须自己挂在 `/desktop/mcp`：

```
FASTMCP_STREAMABLE_HTTP_PATH=/desktop/mcp
```

不然你会得到一堆看起来像隧道问题的 404。

### 10. 便携版 PowerShell 能快 3 倍

`windows-mcp` 会优先用 `pwsh`：

```python
shell = shell or ("pwsh" if shutil.which("pwsh") else "powershell")
```

Windows PowerShell 5.1 每次冷启动 5~6 秒。把便携版 `pwsh` 丢进安装目录、加到子进程 PATH 前面，降到 1~2 秒。

---

## 安全

这套东西等于把**一台电脑的完全管理员控制权**交给持有 token 的人。请务必认真对待：

- `machine.json` / `tunnel.json` / `config.yml` / `cert.pem` **已在 .gitignore 里** —— 保持这样
- token 一机一份，所以泄露只影响那一台
- 轮换方法：改 `machine.json` → `launch.cmd restart`，老 token 立即失效
- 建议在域名前面套一层 Cloudflare Access 做第二重验证

---

## 目录结构

```
src/
  supervisor.py       看门狗、身份加载、单例锁
  bridge_server.py    文件 + 命令 MCP 服务（8000 端口）
  launch.cmd          启动 / 停止 / 状态 / 重启
patches/
  windows_mcp_powershell_utils.py   直接覆盖：消除控制台闪窗
setup/
  install.cmd                 新机安装器
  config.yml.example
  machine.json.example
examples/
  fleet.py                    多机客户端封装
  verify_no_console_flash.py  闪窗验证脚本
docs/
  TROUBLESHOOTING.md          排障手册
```

---

## 致谢与许可

桌面自动化能力来自 [Windows-MCP](https://github.com/CursorTouch/Windows-MCP)（CursorTouch，MIT）。
本仓库是围绕它的部署与加固层。

MIT License —— 见 [LICENSE](LICENSE)。
