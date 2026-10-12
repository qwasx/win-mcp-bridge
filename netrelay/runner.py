"""netrelay/runner.py - 在 GitHub Actions runner 上执行请求里的任务，把结果加密写入 netrelay/results/<id>.enc。

用法（工作流调用）：python netrelay/runner.py netrelay/request.json

仓库是公开的：日志里只打印任务序号、类型、成功与否和字节数，不打印任何返回内容。

任务类型（request.json 的 jobs 数组）：
  {"type":"fetch",  "url":..., "method":"GET", "headers":{...}, "data":"...", "timeout":60}
  {"type":"render", "url":..., "wait":3000, "width":1366, "height":900, "mobile":false, "full":true}
  {"type":"browser","url":... (可选), "script":"<async 函数体，可用 page/browser/out/log/fs/path>", "timeout":300}
  {"type":"sh",     "cmd":"...", "timeout":600}       # bash，工作目录 out/work，那里产生的文件会一起带回
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import box  # noqa: E402

MAX_SEALED = 45 * 1024 * 1024        # 仓库单文件 100MB 上限，留足余量
OUT = Path(os.environ.get("NR_OUT", "/tmp/nr-out"))
WORK = OUT / "work"
PP_DIR = Path("/tmp/nr-pp")


def log(*a):
    print("[netrelay]", *a, flush=True)


# ---------------------------------------------------------------- HTML -> 文本
class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "pre", "table"}

    def __init__(self):
        super().__init__()
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.out.append("\n")
        if tag == "a":
            href = dict(attrs).get("href")
            if href and not href.startswith("javascript"):
                self.out.append(f" [{href}] ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d)


def html_to_text(html: str) -> str:
    p = _Text()
    try:
        p.feed(html)
    except Exception:
        pass
    t = "".join(p.out)
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n\n", t)
    return t.strip()


# ---------------------------------------------------------------- 任务实现
def job_fetch(i, j):
    url = j["url"]
    timeout = int(j.get("timeout", 60))
    body = OUT / f"{i:02d}_fetch.body"
    hdr = OUT / f"{i:02d}_fetch.headers.txt"
    cmd = ["curl", "-sS", "-L", "--compressed", "--max-time", str(timeout), "-D", str(hdr), "-o", str(body),
           "-w", "%{json}", "-X", j.get("method", "GET"),
           "-A", j.get("ua", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36")]
    for k, v in (j.get("headers") or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    if j.get("data") is not None:
        cmd += ["--data-binary", j["data"] if isinstance(j["data"], str) else json.dumps(j["data"])]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 30)
    try:
        meta = json.loads(r.stdout or "{}")
    except Exception:
        meta = {}
    info = {"ok": r.returncode == 0, "curl_exit": r.returncode, "error": r.stderr.strip()[-500:] or None,
            "status": meta.get("http_code"), "final_url": meta.get("url_effective"),
            "content_type": meta.get("content_type"), "bytes": body.stat().st_size if body.exists() else 0,
            "seconds": meta.get("time_total"), "files": []}
    if body.exists():
        ct = (meta.get("content_type") or "").lower()
        ext = ".html" if "html" in ct else ".json" if "json" in ct else ".txt" if ct.startswith("text/") else ""
        name = j.get("save_as") or (Path(re.sub(r"[?#].*$", "", url)).name if not ext else "")
        dst = OUT / (f"{i:02d}_" + (re.sub(r"[^\w.\-]+", "_", name) if name else "fetch") + (ext if not name else ""))
        body.rename(dst)
        info["files"].append(dst.name)
        if "html" in ct:
            txt = OUT / f"{i:02d}_fetch.txt"
            txt.write_text(html_to_text(dst.read_text("utf-8", "replace")), "utf-8")
            info["files"].append(txt.name)
    if hdr.exists():
        info["files"].append(hdr.name)
    return info


def find_chrome():
    for c in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        p = shutil.which(c)
        if p:
            return p
    return None


_pp_ready = None


def ensure_puppeteer():
    global _pp_ready
    if _pp_ready is not None:
        return _pp_ready
    PP_DIR.mkdir(parents=True, exist_ok=True)
    r = subprocess.run("npm init -y >/dev/null && npm i -s puppeteer-core@23 >/dev/null 2>&1", shell=True, cwd=PP_DIR, timeout=300)
    # 中文字体：没有的话截图里中文是方块
    fc = subprocess.run("fc-list :lang=zh | head -1", shell=True, capture_output=True, text=True)
    if not fc.stdout.strip():
        subprocess.run("sudo apt-get -qq update >/dev/null 2>&1; sudo apt-get -qq install -y fonts-noto-cjk >/dev/null 2>&1", shell=True, timeout=400)
    _pp_ready = r.returncode == 0 and find_chrome() is not None
    return _pp_ready


HARNESS = r"""
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const logs = [];
const log = (...a) => logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
(async () => {
  const browser = await puppeteer.launch({ executablePath: job.chrome, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=zh-CN', '--hide-scrollbars'] });
  let page;
  const res = { ok: false };
  try {
    page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' });
    if (job.mobile) await page.emulate(puppeteer.KnownDevices['iPhone 13']);
    else await page.setViewport({ width: job.width || 1366, height: job.height || 900 });
    page.on('console', m => { if (logs.length < 400) logs.push('[console.' + m.type() + '] ' + m.text().slice(0, 500)); });
    page.on('pageerror', e => { if (logs.length < 400) logs.push('[pageerror] ' + String(e).slice(0, 500)); });
    if (job.url) {
      const r = await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => { log('goto: ' + e.message); return null; });
      res.status = r ? r.status() : null;
      await new Promise(r => setTimeout(r, job.wait ?? 3000));
    }
    if (job.script) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const ret = await new AsyncFunction('page', 'browser', 'out', 'log', 'fs', 'path', job.script)(page, browser, out, log, fs, path);
      if (ret !== undefined) fs.writeFileSync(path.join(out, 'return.json'), JSON.stringify(ret, null, 2));
    }
    res.final_url = page.url();
    res.title = await page.title().catch(() => null);
    fs.writeFileSync(path.join(out, 'page.html'), await page.content());
    fs.writeFileSync(path.join(out, 'page.txt'), await page.evaluate(() => document.body ? document.body.innerText : ''));
    await page.screenshot({ path: path.join(out, 'screenshot.png'), fullPage: job.full !== false });
    res.ok = true;
  } catch (e) {
    res.error = String(e && e.stack || e).slice(0, 2000);
    try { if (page) await page.screenshot({ path: path.join(out, 'screenshot_error.png') }); } catch {}
  }
  fs.writeFileSync(path.join(out, 'console.log'), logs.join('\n'));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(res, null, 2));
  await browser.close();
})();
"""


def job_browser(i, j):
    if not ensure_puppeteer():
        return {"ok": False, "error": "puppeteer-core / Chrome 不可用"}
    d = OUT / f"{i:02d}_{j['type']}"
    d.mkdir(parents=True, exist_ok=True)
    h = PP_DIR / "harness.cjs"
    h.write_text(HARNESS)
    spec = dict(j, chrome=find_chrome())
    jf = PP_DIR / f"job{i}.json"
    jf.write_text(json.dumps(spec))
    timeout = int(j.get("timeout", 300))
    try:
        r = subprocess.run(["node", str(h), str(jf), str(d)], cwd=PP_DIR, capture_output=True, text=True, timeout=timeout)
        err = r.stderr.strip()[-1500:] or None
    except subprocess.TimeoutExpired:
        err = f"超时 {timeout}s"
    res = {}
    try:
        res = json.loads((d / "result.json").read_text())
    except Exception:
        pass
    res.setdefault("ok", False)
    if err and not res.get("error"):
        res["node_stderr"] = err
    res["files"] = sorted(f"{d.name}/{p.name}" for p in d.iterdir())
    return res


def job_sh(i, j):
    WORK.mkdir(parents=True, exist_ok=True)
    timeout = int(j.get("timeout", 600))
    so, se = OUT / f"{i:02d}_sh.stdout.txt", OUT / f"{i:02d}_sh.stderr.txt"
    t0 = time.time()
    with open(so, "wb") as fo, open(se, "wb") as fe:
        try:
            r = subprocess.run(["bash", "-o", "pipefail", "-c", j["cmd"]], cwd=WORK, stdout=fo, stderr=fe, timeout=timeout)
            code = r.returncode
        except subprocess.TimeoutExpired:
            code = "timeout"
    return {"ok": code == 0, "exit": code, "seconds": round(time.time() - t0, 1), "files": [so.name, se.name]}


JOBS = {"fetch": job_fetch, "download": job_fetch, "get": job_fetch, "render": job_browser, "browser": job_browser, "sh": job_sh}


# ---------------------------------------------------------------- 打包 + 加密
def pack() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", compresslevel=6) as tf:
        tf.add(OUT, arcname=".")
    return buf.getvalue()


def shrink_until_fits(summary):
    """结果太大：从最大的文件开始删，直到装得下；删了哪些写进 summary。"""
    dropped = []
    while True:
        data = pack()
        if len(data) <= MAX_SEALED * 0.75:      # 加密 + 余量
            return data, dropped
        files = sorted((p for p in OUT.rglob("*") if p.is_file() and p.name != "summary.json"), key=lambda p: p.stat().st_size)
        if not files:
            return data, dropped
        big = files[-1]
        dropped.append({"file": str(big.relative_to(OUT)), "bytes": big.stat().st_size})
        big.unlink()
        summary["dropped_too_large"] = dropped
        (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), "utf-8")


def main():
    req = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    rid, pub, jobs = req.get("id"), req.get("pubkey"), req.get("jobs") or []
    if not rid or not re.fullmatch(r"[\w\-]{6,64}", rid) or not jobs:
        log("占位请求或缺少 id / jobs，不执行。")
        return
    if not pub or "BEGIN PUBLIC KEY" not in pub:
        log("请求里没有公钥，拒绝执行（结果无法加密）。")
        sys.exit(2)
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    summary = {"id": rid, "runner": {"started": time.strftime("%Y-%m-%d %H:%M:%S %Z"), "os": os.uname().sysname,
                                     "run": os.environ.get("GITHUB_RUN_ID")}, "jobs": []}
    for i, j in enumerate(jobs):
        t = j.get("type")
        fn = JOBS.get(t)
        t0 = time.time()
        if not fn:
            res = {"ok": False, "error": f"未知任务类型 {t}"}
        else:
            try:
                res = fn(i, j)
            except Exception as e:
                res = {"ok": False, "error": f"{type(e).__name__}: {str(e)[:500]}"}
        res = {"i": i, "type": t, **res, "elapsed": round(time.time() - t0, 1)}
        summary["jobs"].append(res)
        log(f"任务 {i} {t}: {'成功' if res.get('ok') else '失败'}，{res['elapsed']}s")
    summary["runner"]["finished"] = time.strftime("%Y-%m-%d %H:%M:%S %Z")
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), "utf-8")
    data, dropped = shrink_until_fits(summary)
    sealed = box.seal(data, pub)
    dst = Path("netrelay/results") / f"{rid}.enc"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(sealed)
    log(f"已加密：{len(sealed)} 字节" + (f"（因体积删掉 {len(dropped)} 个文件）" if dropped else ""))


if __name__ == "__main__":
    main()
