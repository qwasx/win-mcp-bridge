# netrelay：借 GitHub Actions 访问外网

有些 AI 代理沙箱只能访问 GitHub，访问不了其它网站（例如 Cloudflare 后面的站点）。
GitHub Actions 的 runner 能上外网，所以让它当跳板：

```
沙箱 ask.py ──① 一次性密钥 + 提交 netrelay/request.json──▶ GitHub
                                                           │ ② 工作流 net-relay 在 runner 上执行任务
                                                           │ ③ 结果打包、用请求方公钥加密
沙箱 ◀──⑤ 拉取、解密、解包── netrelay/results/<id>.enc ◀──④ 提交回同一分支
```

一次请求一般 30～90 秒（起 runner 的时间占大头）。把多个任务放进一次请求更划算。

## 用法

```bash
python3 netrelay/ask.py fetch  https://example.com            # 抓网页/接口，HTML 顺带转纯文本
python3 netrelay/ask.py fetch  https://a.com https://b.com     # 一次多个
python3 netrelay/ask.py get    https://x.com/file.zip          # 下载文件
python3 netrelay/ask.py fetch  https://api.x.com/v1 -X POST -H 'Content-Type: application/json' -d '{"a":1}'
python3 netrelay/ask.py render https://www.wovoon.com --show   # 真浏览器（Chrome）打开 JS 页面：截图 + 渲染后 HTML + 文本 + 控制台
python3 netrelay/ask.py render https://m.example.com --mobile  # 手机模式
python3 netrelay/ask.py browser https://example.com --script s.js   # puppeteer 自动化（点击、输入、翻页）
python3 netrelay/ask.py sh 'curl -sI https://www.cloudflare.com; ping -c2 1.1.1.1'   # 在 runner 上跑命令
python3 netrelay/ask.py jobs my_jobs.json                      # 多个任务，JSON 数组
python3 netrelay/ask.py clean                                  # 删除仓库里残留的加密结果
```

- 结果解到 `~/.cache/netrelay/out/<id>/`（`--out` 可改），终端会列出每个文件。`--show` 直接打印文本结果。
- `sh` 任务的工作目录是 `work/`，在那里生成的文件会一起带回（总量上限约 30 MB，超出从最大的文件开始丢弃并注明）。
- `browser` 脚本是一个 async 函数体，可用变量：`page`、`browser`、`out`（结果目录）、`log(...)`、`fs`、`path`；
  `return` 的值会存成 `return.json`。结束时自动保存截图、HTML、文本、控制台日志。

```js
// s.js 示例：搜索并截图
await page.type('input[name=q]', 'hello');
await page.keyboard.press('Enter');
await page.waitForNavigation({ waitUntil: 'networkidle2' });
return await page.$$eval('a', as => as.slice(0, 20).map(a => a.href));
```

## jobs.json 格式

```json
[
  {"type": "fetch",  "url": "https://example.com", "method": "GET", "headers": {}, "timeout": 60},
  {"type": "get",    "url": "https://example.com/a.zip", "save_as": "a.zip"},
  {"type": "render", "url": "https://example.com", "wait": 3000, "mobile": false, "full": true},
  {"type": "browser","url": "https://example.com", "script": "return await page.title();"},
  {"type": "sh",     "cmd": "dig +short example.com", "timeout": 600}
]
```

## 安全

- **本仓库是公开的。** 请求（网址、命令）明文提交，任何人都能看到——**不要在请求里放密码、令牌、Cookie**。
- 返回内容不进日志；结果用请求方的一次性 RSA-3072 公钥 + AES-256-GCM 加密，私钥只在沙箱 `~/.cache/netrelay/keys/`，用完即删。
- 只在 push 触发（fork 的 PR 拿不到权限），`if: github.repository == 'qwasx/win-mcp-bridge'`。
- 有本仓库推送权限的人都能用它在 runner 上执行命令（runner 是 GitHub 的一次性虚拟机，与任何个人电脑无关）。
- GitHub 规定 Actions 应用于与项目相关的工作（查文档、测试部署、下载依赖等），不要当通用代理大量刷流量。

## 文件

| 文件 | 作用 |
|---|---|
| `.github/workflows/net-relay.yml` | 工作流：执行 → 加密 → 提交 |
| `netrelay/runner.py` | runner 端：fetch / render / browser / sh |
| `netrelay/ask.py` | 沙箱端：提交请求、等待、解密、解包 |
| `netrelay/box.py` | 一次性密钥与混合加密 |
| `netrelay/request.json` | 最近一次请求（只含公钥，可公开） |
| `netrelay/results/*.enc` | 加密结果；下一次请求时自动删除 |
