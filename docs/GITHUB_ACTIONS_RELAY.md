# GitHub Actions 中转：从 AI 代理沙箱连到 pc1

> 有些 AI 代理沙箱能访问 github.com，却连不上 Cloudflare。GitHub Actions 的
> runner 两边都能访问，所以让它当中转。

```
AI 代理沙箱                         GitHub（本仓库，公开）                    pc1
───────────                         ────────────────────                    ───
relay/ask.py
  │ ① 生成一次性 RSA 密钥对（私钥只在沙箱 ~/.cache/pc-relay/）
  │ ② 提交 relay/request.json {id, task, 公钥} 并 push
  └────────────────────────────▶  .github/workflows/pc-relay.yml
                                     │ ③ 校验 task 在白名单里、有公钥
                                     │ ④ relay_client.py --quiet ──HTTPS+Bearer──▶ /desktop/mcp
                                     │    （PC 返回的内容一个字都不进日志）
                                     │ ⑤ 用公钥加密 → relay/results/<id>.enc.json
                                     │ ⑥ 提交回同一分支
  ┌──────────────────────────────── ┘
  │ ⑦ git fetch 拿到密文，用私钥本地解密
  ▼
结果
```

## 为什么这样设计

**本仓库是公开的。** 公开仓库的 Actions 日志、提交内容任何人都能看。所以：

| 风险 | 做法 |
|---|---|
| 日志泄露 PC 信息 | 客户端 `--quiet`，PC 返回内容**不打印**；日志里只有 task、id、退出码、密文字节数 |
| 结果泄露 | 用请求方的一次性 RSA-3072 公钥 + AES-256-GCM 加密后才提交；私钥从不进仓库 |
| 没带公钥 | 工作流直接拒绝运行，不会出现明文结果 |
| 令牌泄露 | 令牌只在仓库 Secrets 里；GitHub 自动遮盖；客户端再逐行遮盖令牌 / `*_token` 字段 / `Bearer xxx` |
| 被人拿来跑任意命令 | 只接受 3 个白名单任务，没有自由命令输入 |
| Fork 滥用 | 只在 push 事件触发（fork 的 PR 拿不到 Secrets），且 `if: github.repository == 'qwasx/win-mcp-bridge'` |
| 两个会话同时操作 pc1 | `concurrency: pc1` 排队 |

公开仓库的 Actions **免费、不限分钟**。

## 任务白名单（第一阶段只读）

| task | 远程工具调用 | 内容 |
|---|---|---|
| `list_tools` | **无**（只有 `list_tools` 协议请求） | 连通性、工具清单及参数结构、有没有 `RunScript` |
| `read_start_here` | ① RunScript 读 README → ② RunScript 读编号文件 | UTF-8 读 `C:\mcp-bridge\START_HERE\README.md`，再按编号（01, 02, …）读完目录里的编号文件，每个附 SHA256 |
| `verify` | ① RunScript 读 README（只记哈希）→ ② RunScript 只读验证 | 机器名、用户、系统版本；`machine.json` 的 4 个公开字段及 `bound_computer` 是否一致；是否在管理员组、当前进程是否已提权 |

- 每次运行都是新的 MCP 会话，所以"**首次远程工具调用必须是 `RunScript(language="python")` 读 README**"
  这条规则在每次运行里都执行一遍。
- 原版 windows-mcp 0.8.5 **没有 `RunScript`**（见 CHANGELOG 1.1.0）。服务端没有 `RunScript`
  时客户端直接停下（退出码 3），**不会改用 `PowerShell`**。
- `machine.json` 里有令牌，只读 `machine_id / label / hostname / bound_computer` 四个字段。
- 默认安装的计划任务不带 `/rl highest`，出现"在管理员组但未提权"是正常的。

## 凭据：两种方式任选

**A. 加密交接（默认，免配置）**：仓库没配 Secrets 时，runner 在自己的临时虚拟机里生成一次性
RSA 密钥对，把公钥提交到 `relay/handshake/<id>.runner.pub.pem`；`ask.py` 核对这个提交确实来自
`github-actions[bot]`，再用它加密 `{url, token}`（来自沙箱里的 `~/.cache/pc-relay/pc1.json`，不进仓库）
提交回去。runner 解密、在日志里遮盖后使用，结束时删除交接文件。能解开凭据的私钥随 runner 销毁。

**B. 仓库 Secrets**：配置了下面的 Secrets 就直接用，不走交接。

## 仓库 Secrets（可选）

在 **Settings → Secrets and variables → Actions → New repository secret** 添加：

| Secret | 值 |
|---|---|
| `PC1_URL` | `https://<pc1 的域名>/desktop/mcp` |
| `PC1_DESKTOP_TOKEN` | pc1 上 `C:\mcp-bridge\machine.json` 里的 `desktop_token` |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | 可选，仅在域名前启用了 Cloudflare Access 时需要 |

另外确认 **Settings → Actions → General** 里 Actions 是允许的。
如果 Cloudflare 开了 Bot Fight Mode / WAF 挑战，给 `/desktop/mcp` 加一条跳过规则，否则 Actions 的 IP 可能被拦。

## 使用（在代理沙箱里）

```bash
pip install "mcp==2.2.0" "httpx2==2.13.1" cryptography
python relay/ask.py list_tools          # 第 0 步：不调用任何远程工具
python relay/ask.py read_start_here     # 第 1 步：读说明
python relay/ask.py verify              # 第 2 步：只读验证
```

一次大约 1～2 分钟（起 runner + 连 PC + 回传）。解密后的明文另存在 `~/.cache/pc-relay/<id>.md`，不进仓库。

## 退出码（写在解密后的结果第一行）

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 连接失败（URL、令牌、Cloudflare） |
| 3 | 服务端没有 `RunScript`，或识别不了它的参数，已按规则停止 |
| 4 | README 读取失败 |
| 5 | 远程脚本报错 |
| 6 | Secrets 没配 |

## 文件

| 文件 | 作用 |
|---|---|
| `.github/workflows/pc-relay.yml` | 工作流：校验 → 运行 → 加密 → 提交 |
| `relay/relay_client.py` | MCP 客户端（mcp 2.x + httpx2，读超时 180 s） |
| `relay/crypto_box.py` | RSA-OAEP + AES-GCM 封装：`keygen` / `seal` / `open` |
| `relay/ask.py` | 请求端：生成密钥、提交请求、交接凭据、等待并解密结果 |
| `relay/handshake.py` | runner 端：一次性密钥、接收加密凭据 |
| `relay/request.json` | 最近一次请求（只含公钥，可公开） |
| `relay/results/*.enc.json` | 密文结果；私钥随会话丢弃后，任何人都解不开 |

## 以后（需要所有者单独同意）

- 写操作任务：仍走白名单，逐个评审
- 截图：加密后回传 PNG
- 多机：`PC2_URL` / `PC2_DESKTOP_TOKEN`，请求里加 `machine` 字段
