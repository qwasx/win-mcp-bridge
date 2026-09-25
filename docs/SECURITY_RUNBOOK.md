# pc1 安全加固手册（给持有 GitHub 令牌的 AI）

> **读者：一个拿到了 GitHub 令牌、能操作 `qwasx/win-mcp-bridge` 仓库的 AI。**
> 目标：把下面 **四件事** 做完、验证、汇报。每一步都有"通过标准"和"失败怎么办"。
> 连接 pc1 的基础知识见 [`AI_HANDOFF.md`](AI_HANDOFF.md)，本文只写加固流程。

| # | 要做的事 | 为什么 |
|---|---|---|
| 1 | **合并 PR #1** | 中转代码进 `main`，以后新开的 AI 会话都能用 |
| 2 | **删掉 START_HERE 文档里的令牌明文** | 现在每个读说明的 AI 都能看到两条线的令牌 |
| 3 | **换令牌**（A 线 + B 线） | 旧令牌出现在聊天记录和文档里，必须作废 |
| 4 | **新令牌只放进 GitHub 仓库 Secrets** | 以后的 AI 不需要知道令牌就能连 |

执行顺序是 **1 → 2 → 3 → 4**（先删文档再换令牌，这样新令牌从来不会被写进文档）。

---

## 第一部分：给用户看（交给 AI 之前）

### A. 创建一个 GitHub 细粒度令牌（Fine-grained token）

用 **qwasx** 账号登录 GitHub，然后打开这个**预填好的链接**（名称、7 天过期、权限都已勾好）：

https://github.com/settings/personal-access-tokens/new?name=pc1-hardening&description=pc1%20security%20runbook%20-%20delete%20after%20use&target_name=qwasx&expires_in=7&contents=write&pull_requests=write&secrets=write&workflows=write&actions=read

打开后**只需要手动做一件事**：Repository access 选 **Only select repositories**，下拉里选 **`win-mcp-bridge`**。
核对下表无误后点 **Generate token**，复制 `github_pat_` 开头的那串（只显示一次）。

不用链接的话：GitHub → 右上角头像 → **Settings → Developer settings（左栏最下面）→ Personal access tokens → Fine-grained tokens → Generate new token**，按下表填。

| 设置项 | 填什么 |
|---|---|
| Token name | `pc1-hardening` |
| Expiration | **7 days**（做完就删，别设永久） |
| Repository access | **Only select repositories → `qwasx/win-mcp-bridge`**（只选这一个） |
| Permissions → Repository | **Contents: Read and write**<br>**Pull requests: Read and write**<br>**Secrets: Read and write**<br>**Workflows: Read and write**<br>**Actions: Read-only**<br>Metadata: Read-only（自动） |

**不要**给账号级权限，**不要**选 All repositories。

### B. 准备好这三样

1. GitHub 令牌（上一步生成的，`github_pat_...` 开头）
2. pc1 的地址：`https://<你的域名>/desktop/mcp`
3. pc1 **当前的** B 线令牌（`C:\mcp-bridge\machine.json` 里的 `desktop_token`）

### C. 第 3 件事（换令牌）进行时，人最好在电脑旁边

AI 会重启桥。脚本自带**自动回滚**，但万一重启失败，远程谁都连不上，只能你在电脑前恢复（见第五部分，1 分钟的事）。
另外：**任何还在用旧令牌的程序会断开**，例如本机 AI「阿桥」如果用 A 线令牌，换完要更新。

### D. 发给 AI 的一句话

```
请严格按 qwasx/win-mcp-bridge 仓库 docs/SECURITY_RUNBOOK.md 执行 pc1 的安全加固，四件事按顺序做，
改动电脑前按手册向我确认。所有令牌都不许回显、不许写进仓库。
GITHUB_TOKEN = <github_pat_...>
PC1_URL      = https://<域名>/desktop/mcp
PC1_TOKEN    = <当前 B 线令牌>
```

### E. 做完之后你要做的

- 到 GitHub 把 `pc1-hardening` 这个令牌**删掉**（Settings → Developer settings → 对应令牌 → Delete）。
- 新令牌在你电脑的 `C:\mcp-bridge\machine.json` 里，自己用时去那里看。

---

## 第二部分：AI 的铁律

1. **三种令牌都不回显**：GitHub 令牌、旧 pc1 令牌、新 pc1 令牌。回复、日志、提交信息、报错里都不能出现。要指代时用 `tokens.py status` 给出的 **sha256 指纹**。
2. **不写进仓库**。本仓库是**公开的**。令牌只放在环境变量或 `~/.cache/pc-relay/`（600 权限）。
3. GitHub 令牌只用环境变量 `GH_TOKEN`，**不要** `gh auth login` 持久化，**不要**写进 `git config` 或 remote URL。
4. **改动电脑的步骤（第 2、3 件事）必须先得到用户在对话里明确的"同意"**，并且只做本手册写的改动。
5. **失败就停下汇报**，不要自己想办法绕过、不要手工改 `C:\mcp-bridge\` 里的文件、不要跳步骤。
6. pc1 上 START_HERE 的规则同样有效（只读随便做；删文件、杀进程、改注册表、装卸软件、前台点击、改 `C:\mcp-bridge\` 之前先问）。与本手册冲突时，**按更严格的执行**。

---

## 第三部分：准备

```bash
export GH_TOKEN='<github_pat_...>'            # 只放环境变量
gh auth status                                  # 应显示已登录；不要打印令牌

gh auth setup-git                               # git push 通过 gh 取 GH_TOKEN，不落盘保存令牌
gh repo clone qwasx/win-mcp-bridge && cd win-mcp-bridge
pip install "mcp>=2.2" "httpx2>=2.13" cryptography   # httpx2，不是 httpx

umask 077; mkdir -p ~/.cache/pc-relay
cat > ~/.cache/pc-relay/pc1.json <<'EOF'
{"url": "<PC1_URL>", "token": "<PC1_TOKEN>"}
EOF
python relay/tokens.py status                   # 只显示指纹
```

### 选连接方式

```bash
curl -sS -m 10 -o /dev/null -w "%{http_code}\n" "<PC1_URL>"     # 不带令牌
```

- 返回任意 3 位 HTTP 码 → **直连**
- `000` / TLS 错误 → **中转**（GitHub Actions）

下文用 `RUN <task>` 表示执行一个任务：

| | 直连 | 中转 |
|---|---|---|
| 只读任务 | `PC_URL=… PC_TOKEN=… python relay/relay_client.py <task>` | `python relay/ask.py <task>` |
| 改动任务 | `RELAY_APPROVED=yes PC_URL=… PC_TOKEN=… python relay/relay_client.py <task> --out ~/.cache/pc-relay/<task>.md` | `python relay/ask.py <task> --approved` |

直连时从 `pc1.json` 取值：

```bash
export PC_URL=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.cache/pc-relay/pc1.json')))['url'])")
export PC_TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.cache/pc-relay/pc1.json')))['token'])")
```

（**换令牌、`promote` 之后要重新执行这两行**，否则还在用旧令牌。）

可用任务：

| 任务 | 类型 | 作用 |
|---|---|---|
| `list_tools` | 只读 | 连通性 + 工具清单（不调用远程工具） |
| `read_start_here` | 只读 | 读 START_HERE 的 README 和编号文档 |
| `verify` | 只读 | 机器身份、管理员权限 |
| `rotate_preflight` | 只读* | 换令牌前的预检；*会在 `C:\mcp-bridge\backups\` 写一个报告文件夹，并起一个后台探测进程 |
| `rotate_status` | 只读 | 读预检探测结果、换令牌进度 |
| `scrub_start_here` | **改动** | 把 START_HERE 文档里的当前令牌替换成占位符（先备份） |
| `rotate_tokens` | **改动** | 备份 `machine.json`，写入两个新随机令牌，后台重启桥，新令牌不通就**自动回滚** |

每个任务（`list_tools` 除外）的**第一个远程调用都是 `RunScript(language="python")` 读 `README.md`**，这是 pc1 的规矩，脚本已经处理好了。

**中转模式的分支**：`ask.py` 会往当前分支提交请求。合并 PR 之后，从 `main` 开一个专用分支再干活，别往 `main` 堆提交：

```bash
git fetch origin && git switch -c relay-ops origin/main && git push -u origin relay-ops
```

---

## 第四部分：执行

### 步骤 1 · 合并 PR #1

```bash
gh pr view 1 --repo qwasx/win-mcp-bridge --json state,mergeable,files -q '.state, .mergeable, (.files[].path)'
```

**先审查再合并**。通过标准：

- `state` 是 `OPEN`，`mergeable` 是 `MERGEABLE`
- 改动的文件只在 `.github/workflows/pc-relay.yml`、`relay/`、`docs/`、`README*.md`
- diff 里没有令牌：`gh pr diff 1 --repo qwasx/win-mcp-bridge | grep -nE "github_pat_|Bearer [A-Za-z0-9_-]{30,}"` 应无输出
  （`relay/results/`、`relay/handshake/` 里是密文，正常）

```bash
gh pr merge 1 --repo qwasx/win-mcp-bridge --merge
```

然后按上面的说明切到 `relay-ops` 分支。

**失败**：`mergeable` 不是 `MERGEABLE`、或出现了上面列表以外的文件 → 停下，告诉用户。

---

### 步骤 2 · 开局（只读）

```
RUN list_tools
RUN read_start_here
RUN verify
```

通过标准：

- 工具里有 `RunScript`（没有 → **停下问用户，不要改用 PowerShell**）
- 读完所有编号文档，并遵守其中的规则
- `verify`：`COMPUTERNAME=SD-20260915LSPQ`、`machine_id=pc1`、`bound_computer_matches=true`
  **机器名对不上 → 立刻停下**：可能连到了别的机器

---

### 步骤 3 · 征得用户同意（必须）

把下面这段发给用户，**等到明确的"同意"再继续**：

```
接下来我要改动 pc1，内容如下，请回复"同意"：
1. 把 C:\mcp-bridge\START_HERE\ 里文档中出现的当前令牌替换成占位符（原文件先备份到 C:\mcp-bridge\backups\）。
2. 备份 C:\mcp-bridge\machine.json，给 A 线和 B 线各生成一个新的随机令牌，然后重启桥（约 1～3 分钟连不上）。
   如果新令牌验证不通过，会自动恢复旧文件并再次重启。
   换完后，所有还在用旧令牌的程序（例如本机「阿桥」如果用 A 线）会断开。
3. 把新令牌写进 GitHub 仓库 Secrets（PC1_URL / PC1_DESKTOP_TOKEN / PC1_BRIDGE_TOKEN）。
换令牌时最好有人在电脑旁边，万一重启失败需要手工恢复。
```

用户只同意其中一部分 → 只做那一部分。

---

### 步骤 4 · 删掉 START_HERE 里的令牌

```
RUN scrub_start_here          (改动任务)
```

通过标准：

- 输出 `CHANGED_FILES: [...]`（预期包括 `00-一句话上手.md`、`02-连接方式.md`）和 `BACKUP_DIR: ...`
- 再跑一次 `RUN read_start_here`，确认输出里**已经没有**令牌，只剩占位符
  （中转/直连客户端会把当前 B 线令牌替换成 `<REDACTED>`，所以还要检查输出里有没有**别的长串**：
  `grep -E "[A-Za-z0-9_-]{40,}"` 只应匹配到 SHA256 哈希）

`OTHER_FILES_CONTAINING_CURRENT_TOKENS` 里列出的文件**不要动**，把清单报告给用户。
（`.bridge_token` 出现在清单里是正常的；换令牌后旧值作废。）

**失败**（`VERIFY FAILED` 或报错）→ 停下，把 `BACKUP_DIR` 告诉用户。

---

### 步骤 5 · 换令牌前的预检

```
RUN rotate_preflight
# 等 30 秒（后台探测进程要先等 RunScript 返回）
RUN rotate_status
```

**全部满足才能进入步骤 6**：

| 检查项 | 要求 |
|---|---|
| `machine.json readable` / `has bridge_token/desktop_token` | `true` / `true` |
| `bound_computer == COMPUTERNAME` | `true` |
| `MCP-Stack` | 存在，`Task To Run` 指向 `pythonw.exe ... supervisor.py` |
| `port detection usable` | `true` |
| `detached spawn via WMI` | `ok (0 <pid>)` |
| `backups writable` | `true` |
| `rotate_status` 里 `probe.json` 的 `probe_logic_usable` | **`true`**（当前令牌 → 非 401，随机令牌 → 401） |

`probe_logic_usable` 为 `true`，说明后台看门狗能在本机判断新令牌是否生效，自动回滚是可靠的。
**任何一项不满足 → 停下，把预检输出（不含令牌）报告给用户，不要换令牌。**
`probe.json` 还没生成 → 再等 30 秒重跑 `rotate_status`；两分钟还没有就算失败。

---

### 步骤 6 · 换令牌

```
RUN rotate_tokens             (改动任务)
```

- 中转模式：`ask.py` 会自动把新令牌存到 `~/.cache/pc-relay/new_tokens.json`，屏幕上只显示 `<REDACTED>`。
- 直连模式：执行 `python relay/tokens.py extract ~/.cache/pc-relay/rotate_tokens.md`。

输出里应有 `BACKUP_DIR: ...rotate-tokens-...` 和 `WATCHDOG: 0 <pid>`。然后：

```
# 等 90 秒
RUN rotate_status             ← 这一步用"旧"令牌连；如果连不上，先执行下面的 promote 再用新令牌试
```

> 桥重启时连不上是正常的。连接失败就每 30 秒重试一次，最多 6 分钟。
> 看门狗换完后，**旧令牌不再有效**（除非回滚了），所以 `rotate_status` 可能需要用新令牌才能连上：
> 先 `python relay/tokens.py promote`，直连模式再重新导出 `PC_TOKEN`。

按 `status.json` 的 `result` 处理：

| result | 含义 | 下一步 |
|---|---|---|
| `running` | 看门狗还在跑 | 30 秒后再查 |
| `ok` | 新令牌生效，旧令牌 401 | `tokens.py promote` → `RUN verify` 通过 → 步骤 7 |
| `inconclusive_kept_new` | 桥已起来，但本机探测区分不了新旧 | `tokens.py promote` → `RUN verify`；通过就继续，不通过按"完全连不上"处理 |
| `rolled_back` / `error_rolled_back` | 已自动恢复旧令牌 | 如果已经 promote 过就 `tokens.py demote`；用旧令牌 `RUN verify` 确认能连；**停下**，把 `steps` 发给用户 |
| `error_rollback_failed` | 回滚也失败了 | **立刻**请用户按第五部分手工恢复 |

**新旧令牌都连不上超过 6 分钟** → 请用户在电脑前按第五部分恢复，并告诉他 `BACKUP_DIR`。

---

### 步骤 7 · 新令牌写进 GitHub Secrets

```bash
python relay/tokens.py push-secrets --repo qwasx/win-mcp-bridge
gh secret list --repo qwasx/win-mcp-bridge        # 应看到 PC1_URL / PC1_DESKTOP_TOKEN / PC1_BRIDGE_TOKEN
```

**验证 Secrets 真的能用**（这是以后所有 AI 走的路）。把本地凭据挪开，强制走 Secrets：

```bash
mv ~/.cache/pc-relay/pc1.json ~/.cache/pc-relay/pc1.json.bak
python relay/ask.py verify          # 无论你是直连还是中转环境，都跑一次中转
mv ~/.cache/pc-relay/pc1.json.bak ~/.cache/pc-relay/pc1.json
```

通过标准：`verify` 成功，且过程中**没有**出现 `sent sealed credentials`（说明 runner 用的是 Secrets，没走交接）。

---

### 步骤 8 · 收尾与汇报

```bash
python relay/tokens.py shred        # 删除本地所有 URL / 令牌副本
unset GH_TOKEN PC_TOKEN PC_URL
```

汇报模板（**不含任何令牌**，指纹可以写）：

```
1. PR #1：已合并（merge commit xxxxxxx）
2. START_HERE：已替换 N 个文件（…），备份在 C:\mcp-bridge\backups\scrub-start-here-…
   其他仍含旧令牌的文件（未改动）：…
3. 换令牌：result=ok，备份在 C:\mcp-bridge\backups\rotate-tokens-…；旧令牌已失效（401）
   新 B 线令牌指纹 xxxxxxxx，新 A 线令牌指纹 xxxxxxxx
4. Secrets：PC1_URL / PC1_DESKTOP_TOKEN / PC1_BRIDGE_TOKEN 已写入，中转验证通过（未走交接）
本地令牌副本已清除。
请你：① 删除 GitHub 令牌 pc1-hardening；② 更新还在用旧令牌的程序（如「阿桥」）；
③ 新令牌在 C:\mcp-bridge\machine.json；④ backups 里的旧令牌已作废，可自行删除。
```

---

## 第五部分：手工恢复（用户在电脑前做）

适用于：换令牌后新旧令牌都连不上。

1. 打开 `C:\mcp-bridge\backups\`，找到最新的 `rotate-tokens-日期-xxxx` 文件夹。
2. 先看里面的 `status.json`（记事本打开），把内容发给 AI 或自己看 `result`。
3. 把这个文件夹里的 `machine.json` **复制**回 `C:\mcp-bridge\machine.json`（覆盖）。
4. 双击 `C:\mcp-bridge\launch.cmd`，或者命令行执行 `C:\mcp-bridge\launch.cmd restart`。
   也可以直接**注销再登录** Windows（开机任务会重新拉起桥）。
5. 这时旧令牌恢复有效，告诉 AI 继续或排查。

---

## 第六部分：排障

| 现象 | 处理 |
|---|---|
| `gh: Resource not accessible` / 403 | GitHub 令牌权限不够，对照第一部分 A 的表检查 |
| `gh pr merge` 报 workflow 相关错误 | 令牌缺 **Workflows: Read and write** |
| `ask.py` 一直看不到 workflow run | 当前分支没有工作流文件（PR 没合并 / 没从 `main` 开分支），或 Settings → Actions 被禁用 |
| 退出码 7 / `needs the user's explicit approval` | 改动任务少了 `--approved` / `RELAY_APPROVED=yes`；先确认用户同意了 |
| 退出码 3 | 服务端没有 `RunScript`，停下问用户 |
| `probe_logic_usable: false` | 本机探测不可靠，**不要换令牌**，报告用户 |
| `rotate_status` 里看不到 `status.json` | 看门狗没启动或刚启动；再等；`WATCHDOG` 返回码不是 0 时脚本已自动恢复 `machine.json` |
| 换完后 `verify` 报 401 | 客户端还在用旧令牌：`tokens.py promote`，直连模式重新导出 `PC_TOKEN` |

---

## 第七部分：做完后的安全状况

**解决了的**：

- 聊天记录里、START_HERE 文档里的旧令牌全部作废。
- 以后的 AI 通过 Secrets 走中转，**不需要知道令牌**；令牌不再出现在任何聊天里。
- 仓库是公开的，但里面只有公钥和密文；fork 拿不到 Secrets；工作流只在本仓库运行。

**仍然存在的风险**（如实告诉用户）：

- **有本仓库写权限的人能控制 pc1**（可以改工作流）。只给自己和信任的 AI 写权限；
  **不要合并别人提交的、改了 `.github/workflows/` 或 `relay/` 的 PR**。
- pc1 以管理员权限运行，域名是公开的；令牌是唯一的门。建议在 Cloudflare 上给域名加 **Access** 认证，
  中转已支持 `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` 两个 Secrets。
- GitHub 令牌 `pc1-hardening` 用完要删。
