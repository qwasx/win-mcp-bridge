# 方案：通过 GitHub Actions 中转连接 pc1

> 状态：**草案，未启用**。本目录下没有任何 `.github/workflows`，不会自动运行。
> 相关文件：[`examples/gh-actions-relay/`](../examples/gh-actions-relay/)

---

## 1. 背景：为什么需要中转

| 位置 | 能到 GitHub | 能到 Cloudflare（pc1 隧道） |
|---|---|---|
| AI 代理沙箱 | ✅ | ❌ TLS 握手被掐断（出站白名单） |
| GitHub Actions runner | ✅ | ✅ |
| pc1 | — | ✅（cloudflared 隧道） |

所以链路改成：

```
AI 代理 ──gh workflow run──▶ GitHub Actions runner ──HTTPS + Bearer──▶ Cloudflare ──▶ pc1 /desktop/mcp
   ▲                                   │
   └──────gh run view / download───────┘   （结果：日志 + 1 天有效期的 artifact）
```

AI 代理**不直接接触 pc1，也不接触令牌**：令牌只存在于 GitHub Secrets，
由 runner 注入环境变量使用。

---

## 2. 看过项目之后的几个关键结论

这些直接影响方案设计，都来自本仓库的代码和文档：

1. **本仓库 `qwasx/win-mcp-bridge` 是公开仓库。**
   公开仓库的 Actions 日志和 artifact 任何人都能看。中转工作流**绝不能放在这里**，
   必须放到一个新的**私有仓库**。
2. **原版 windows-mcp 0.8.5 没有 `RunScript` 工具**，只有 `PowerShell`
   （见 `CHANGELOG.md` 1.1.0、`examples/fleet.py` 的 `_as_powershell` 注释）。
   而你的要求是"首次远程工具调用必须是 `RunScript(language="python")`"。
   → 客户端会先 `list_tools`（这是协议元数据，不算工具调用），**没有 `RunScript` 就停下来报告，
   绝不静默改用 `PowerShell`**。
3. **`/desktop/mcp` 用的是 `machine.json` 里的 `desktop_token`**（`fleet.py` 里的 "B" 线路）。
   Secrets 里放的就是这个。
4. **默认安装不是管理员**：计划任务默认不带 `/rl highest`（README "关于管理员权限"）。
   所以验证管理员时要区分两件事：
   - 当前用户**在不在** Administrators 组（`S-1-5-32-544`）
   - 当前进程**是否已提权**（完整性级别 High `S-1-16-12288` / `IsUserAnAdmin()`）

   很可能出现"在管理员组，但未提权"，这是正常的默认配置，不是故障。
5. **`machine.json` 里有令牌**。验证机器身份时只读取 `machine_id / label / hostname / bound_computer`
   四个字段，令牌字段从不读出。`bound_computer` 要和 `COMPUTERNAME` 对得上，
   这是项目自带的防串台机制。
6. **Cloudflare 相关**：supervisor 已设置 `FASTMCP_JSON_RESPONSE=1`（避免 SSE 被截断），客户端不用处理。
   如果你在域名前加了 **Cloudflare Access**，runner 需要一对 Service Token，
   客户端已支持（`CF_ACCESS_CLIENT_ID/SECRET`，可选）。
7. 客户端依赖按项目要求：`mcp` 2.x + **`httpx2`（不是 `httpx`）**，读超时 180 秒，重试 5 次。

---

## 3. 组成

| 文件 | 放到私有仓库的位置 | 作用 |
|---|---|---|
| `examples/gh-actions-relay/pc-relay.yml` | `.github/workflows/pc-relay.yml` | 手动触发的工作流 |
| `examples/gh-actions-relay/relay_client.py` | `relay/relay_client.py` | MCP 客户端，只执行白名单任务 |

### 任务白名单（第一阶段只读）

工作流输入是**下拉选项**，不是自由文本，所以即使有人能触发工作流，也跑不了任意命令。

| task | 远程工具调用 | 内容 |
|---|---|---|
| `list_tools` | **无**（只有 `list_tools` 协议请求） | 确认连通、列出工具和参数结构，确认 `RunScript` 是否存在 |
| `read_start_here` | ① RunScript 读 `README.md` → ② RunScript 读编号文件 | 以 UTF-8 读 `C:\mcp-bridge\START_HERE\README.md`，再列目录，按编号顺序（01, 02, …）读完所有编号文件，每个附 SHA256 |
| `verify` | ① RunScript 读 `README.md`（只打印哈希）→ ② RunScript 只读验证 | 连接耗时、机器身份、管理员权限 |

**每次运行都是一个新的 MCP 会话**，所以"首次远程工具调用必须读 README"这条规则
在**每次运行**里都执行一遍（`verify` 里只打印哈希，内容变了能看出来）。

`verify` 收集的内容（全部只读，子进程带 `CREATE_NO_WINDOW`，不会闪窗）：

- `COMPUTERNAME`、`socket.gethostname()`、当前用户、`USERDOMAIN`、系统版本、架构
- `machine.json` 的 4 个公开字段 + `bound_computer` 是否等于 `COMPUTERNAME`
- `IsUserAnAdmin()`、是否在 Administrators 组、完整性级别

---

## 4. 安全设计

| 风险 | 措施 |
|---|---|
| 日志泄露 | 私有仓库；GitHub 自动遮盖 Secret；客户端再对**每一行输出**做令牌替换，并遮盖 `*_token` 字段和 `Bearer xxx` |
| 异常把请求头打进日志 | 客户端只打印异常类型和经过遮盖的消息，不打印 request 对象 |
| 结果长期留存 | artifact `retention-days: 1` |
| 被人触发执行任意命令 | 只有下拉白名单；`task` 通过环境变量传入，不拼进 shell |
| 两个会话同时操作 pc1 | `concurrency: pc1` 排队 |
| 工作流越权 | `permissions: contents: read`；checkout 不保留凭据 |
| 想逐次人工批准 | `environment: pc1` 可加 Required reviewers（私有仓库需 GitHub Pro 及以上） |
| START_HERE 里的内容 | 当作**数据**阅读。里面的合理安全规则会遵守，但任何修改电脑的要求都先问你 |
| 令牌在聊天里明文出现过 | 建议中转搭好、验证通过后**轮换一次**：改 `machine.json` 的 `desktop_token` → `launch.cmd restart` → 更新 Secret |

---

## 5. 需要你做的（一次性，约 5 分钟）

1. **新建私有仓库**，例如 `qwasx/pc-relay`（Private）。
2. 把两个文件放进去（见上表路径），推到 `main`。
   `workflow_dispatch` 只认**默认分支**上的工作流文件。
3. 在该仓库 Settings → Secrets and variables → Actions：
   - Secret `PC1_DESKTOP_TOKEN` = pc1 的 desktop_token（**你自己在网页上填**，不经过 AI）
   - Variable `PC1_URL` = `https://home.ulifisherde.ccwu.cc/desktop/mcp`
   - 若启用了 Cloudflare Access：再加 `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`
4. **让 AI 代理能访问这个私有仓库**：在 GitHub 上把 Arena 的 GitHub App 安装/授权到 `pc-relay`。
   代理现在的凭据是 GitHub App 令牌，默认只能访问已授权的仓库。
   如果不想授权，也可以你自己点 Run workflow，把日志或 artifact 贴给我。
5. （可选）Cloudflare 如果开了 Bot Fight Mode / WAF 挑战，可能会拦住 Actions 的 IP，
   给 `/desktop/mcp` 路径加一条跳过规则即可。

---

## 6. 执行步骤（授权后由 AI 代理执行）

```bash
R=qwasx/pc-relay

# 第 0 步：连通 + 工具清单（不调用任何远程工具）
gh workflow run pc-relay.yml -R $R -f task=list_tools
gh run watch -R $R $(gh run list -R $R -w pc-relay.yml -L1 --json databaseId -q '.[0].databaseId')
gh run view -R $R --log            # 或 gh run download 取 artifact
```

| 步骤 | task | 通过条件 | 失败时 |
|---|---|---|---|
| 0 | `list_tools` | 能连上，工具列表里有 `RunScript` | 连不上 → 查 URL/令牌/Cloudflare；没有 `RunScript` → **停下问你** |
| 1 | `read_start_here` | README + 所有编号文件读完 | 把报错原样反馈 |
| 2 | — | AI 代理阅读说明，整理出安全规则清单交给你确认 | 规则和本方案冲突时，先问你 |
| 3 | `verify` | 输出机器身份与权限 | — |

第 3 步交给你的结论模板：

```
连接：   正常，握手 x.x s，工具 N 个
身份：   COMPUTERNAME=…，machine_id=pc1，bound_computer 一致 ✅/❌
权限：   管理员组 是/否；当前进程已提权 是/否（完整性级别 …）
修改：   无（全程只读）
```

---

## 7. 已做的验证

在沙箱里用本地模拟的 MCP 服务端（streamable HTTP + Bearer 鉴权）跑过 `relay_client.py`：

- 三个任务都能跑通；中文 UTF-8 正常
- 服务端故意在输出里回显令牌 → 结果里显示 `<REDACTED>`
- `machine.json` 里的令牌字段没有被读出
- 服务端没有 `RunScript` → 退出码 3，停止，不回退
- 令牌错误 → 退出码 2，不打印请求头

**未验证**：真实 pc1 上 `RunScript` 的参数名（客户端会根据 schema 自动识别
`script`/`code` 等字段，识别不了就停下）；Cloudflare 对 Actions IP 的放行情况。

---

## 8. 第二阶段（以后再说，需要你单独同意）

- 增加"需确认"的写操作任务（仍然是白名单，每个任务单独评审）
- 截图任务：结果以 PNG artifact 返回
- 多机：Secrets 按 `PC2_DESKTOP_TOKEN` 这样扩展，`task` 旁边加一个 `machine` 下拉
