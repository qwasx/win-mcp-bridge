#!/usr/bin/env python3
"""netrelay/ask.py - 在只能访问 GitHub 的沙箱里，借 GitHub Actions 访问外网。

    python3 netrelay/ask.py fetch  URL [URL ...]           # 抓网页/接口（curl），HTML 会顺带转成纯文本
    python3 netrelay/ask.py get    URL [--save-as 名字]    # 下载文件
    python3 netrelay/ask.py render URL [--mobile] [--wait 毫秒]   # 真浏览器打开：截图 + 渲染后的 HTML + 文本 + 控制台日志
    python3 netrelay/ask.py browser [URL] --script 文件.js  # 浏览器自动化（puppeteer），脚本是 async 函数体
    python3 netrelay/ask.py sh     '命令'                   # 在 runner 上跑 bash，work/ 下生成的文件一起带回
    python3 netrelay/ask.py jobs   请求.json                # 一次提交多个任务（JSON 数组）
    python3 netrelay/ask.py clean                           # 删除仓库里残留的加密结果

通用参数：--out 目录（默认 ~/.cache/netrelay/out/<id>）  --timeout 秒（默认 900）  --show 打印文本结果

流程：生成一次性密钥 → 提交 netrelay/request.json 并 push → 工作流 net-relay 执行
→ 结果加密提交回同一分支 → 这里拉取、解密、解包。请求内容（网址、命令）是公开的，别放密码。
"""
import argparse
import io
import json
import os
import subprocess
import sys
import tarfile
import time
import uuid
from pathlib import Path


def _ensure_crypto():
    try:
        import cryptography  # noqa: F401
    except ImportError:
        print("首次使用：安装 cryptography …", file=sys.stderr)
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--user", "--break-system-packages", "cryptography"],
                       check=False)
        import site
        sys.path.insert(0, site.getusersitepackages())


_ensure_crypto()
sys.path.insert(0, str(Path(__file__).resolve().parent))
import box  # noqa: E402

CACHE = Path.home() / ".cache" / "netrelay"
REL_REQ = "netrelay/request.json"
REL_RES = "netrelay/results"


def git(*a, check=True, binary=False, cwd=None):
    r = subprocess.run(["git", *a], capture_output=True, cwd=cwd or ROOT, text=not binary)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(a)} 失败：{(r.stderr if not binary else r.stderr.decode())[-800:]}")
    return r.stdout if r.returncode == 0 else None


ROOT = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True,
                           cwd=Path(__file__).resolve().parent).stdout.strip())


def branch():
    b = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    if b == "HEAD":
        raise SystemExit("当前不在分支上（detached HEAD）")
    return b


def sync(b):
    git("pull", "-q", "--rebase", "--autostash", "origin", b, check=False)


def push(b):
    for i in range(6):
        if git("push", "-q", "origin", f"HEAD:{b}", check=False) is not None:
            return
        sync(b)
        time.sleep(2 + i * 2)
    raise SystemExit("push 失败")


def submit(jobs):
    b = branch()
    sync(b)
    rid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]
    priv, pub = box.keygen()
    (CACHE / "keys").mkdir(parents=True, exist_ok=True)
    kp = CACHE / "keys" / f"{rid}.pem"
    kp.touch(mode=0o600)
    kp.write_bytes(priv)
    req = {"id": rid, "created": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "pubkey": pub, "jobs": jobs}
    (ROOT / REL_REQ).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / REL_REQ).write_text(json.dumps(req, ensure_ascii=False, indent=2) + "\n", "utf-8")
    old = git("ls-files", REL_RES).split()
    if old:
        git("rm", "-q", "--", *old)
    git("add", REL_REQ)
    types = ",".join(sorted({j.get("type", "?") for j in jobs}))
    git("commit", "-q", "-m", f"netrelay: request {rid} ({types})", "--", REL_REQ, *old)
    push(b)
    sha = git("rev-parse", "HEAD").strip()
    return b, rid, sha, kp


def run_state(b, sha):
    r = subprocess.run(["gh", "run", "list", "--workflow", "net-relay.yml", "--branch", b, "--limit", "15",
                        "--json", "headSha,status,conclusion,databaseId"], capture_output=True, text=True, cwd=ROOT)
    try:
        for x in json.loads(r.stdout or "[]"):
            if x.get("headSha") == sha:
                return x
    except Exception:
        pass
    return None


def wait_result(b, rid, sha, timeout):
    path = f"{REL_RES}/{rid}.enc"
    t0 = time.time()
    last_note = 0
    while time.time() - t0 < timeout:
        time.sleep(4)
        git("fetch", "-q", "origin", b, check=False)
        blob = git("show", f"FETCH_HEAD:{path}", check=False, binary=True)
        if blob:
            return blob
        el = time.time() - t0
        if el - last_note >= 20:
            last_note = el
            st = run_state(b, sha)
            if st and st.get("status") == "completed" and st.get("conclusion") != "success":
                raise SystemExit(f"工作流失败：{st.get('conclusion')}（run {st.get('databaseId')}）。"
                                 f"查看：gh run view {st.get('databaseId')}")
            if st and st.get("status") == "completed":
                # 成功但还没看到提交：再等一会儿
                pass
            print(f"  … 已等 {int(el)}s（{(st or {}).get('status', '排队中')}）", file=sys.stderr)
    raise SystemExit(f"等待超时（{timeout}s）。请求 id={rid}，稍后可用：python3 netrelay/ask.py fetchresult {rid}")


def unpack(blob, kp, out):
    data = box.open_box(blob, kp.read_bytes())
    out.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
        for m in tf.getmembers():
            p = (out / m.name).resolve()
            if not str(p).startswith(str(out.resolve())) or m.issym() or m.islnk():
                raise SystemExit(f"结果包里有可疑路径：{m.name}")
        tf.extractall(out)
    return json.loads((out / "summary.json").read_text("utf-8"))


def report(summary, out, show):
    print(f"\n结果目录：{out}")
    for j in summary.get("jobs", []):
        bits = [f"#{j['i']} {j['type']}", "✅" if j.get("ok") else "❌"]
        for k in ("status", "exit", "title", "final_url", "bytes", "elapsed"):
            if j.get(k) not in (None, ""):
                bits.append(f"{k}={j[k]}")
        if j.get("error"):
            bits.append(f"error={str(j['error'])[:300]}")
        print("  " + "  ".join(map(str, bits)))
        for f in j.get("files", []):
            print(f"      {out / f}")
        if show:
            for f in j.get("files", []):
                if f.endswith((".txt", ".json", ".log")) and "headers" not in f:
                    t = (out / f).read_text("utf-8", "replace")
                    print(f"----- {f}（{len(t)} 字）-----\n{t[:show]}\n")
    if summary.get("dropped_too_large"):
        print("  ⚠ 体积太大被删掉的文件：", summary["dropped_too_large"])


def finish(b, rid, blob, kp, out, show):
    out = Path(out) if out else CACHE / "out" / rid
    summary = unpack(blob, kp, out)
    sync(b)
    kp.unlink(missing_ok=True)
    report(summary, out, show)
    return summary


def main():
    ap = argparse.ArgumentParser(description="借 GitHub Actions 访问外网")
    ap.add_argument("cmd", choices=["fetch", "get", "render", "browser", "sh", "jobs", "clean", "fetchresult"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--out")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--show", type=int, nargs="?", const=4000, default=0, help="打印文本结果（默认前 4000 字）")
    ap.add_argument("--mobile", action="store_true")
    ap.add_argument("--wait", type=int, default=3000)
    ap.add_argument("--script")
    ap.add_argument("--save-as")
    ap.add_argument("-H", "--header", action="append", default=[])
    ap.add_argument("-X", "--method", default="GET")
    ap.add_argument("-d", "--data")
    a = ap.parse_args()

    headers = dict(h.split(":", 1) for h in a.header) if a.header else {}
    headers = {k.strip(): v.strip() for k, v in headers.items()}
    if a.cmd == "clean":
        b = branch(); sync(b)
        old = git("ls-files", REL_RES).split()
        if old:
            git("rm", "-q", "--", *old); git("commit", "-q", "-m", "netrelay: clean results", "--", *old); push(b)
        print(f"已清理 {len(old)} 个结果文件")
        return
    if a.cmd == "fetchresult":
        rid = a.args[0]; b = branch()
        git("fetch", "-q", "origin", b)
        blob = git("show", f"FETCH_HEAD:{REL_RES}/{rid}.enc", binary=True)
        finish(b, rid, blob, CACHE / "keys" / f"{rid}.pem", a.out, a.show)
        return

    if a.cmd in ("fetch", "get"):
        if not a.args:
            ap.error("需要至少一个 URL")
        jobs = [{"type": "fetch", "url": u, "method": a.method, "headers": headers,
                 **({"data": a.data} if a.data is not None else {}),
                 **({"save_as": a.save_as} if a.save_as and len(a.args) == 1 else {})} for u in a.args]
    elif a.cmd == "render":
        if not a.args:
            ap.error("需要 URL")
        jobs = [{"type": "render", "url": u, "mobile": a.mobile, "wait": a.wait} for u in a.args]
    elif a.cmd == "browser":
        if not a.script:
            ap.error("需要 --script 文件.js")
        jobs = [{"type": "browser", "url": a.args[0] if a.args else None, "mobile": a.mobile, "wait": a.wait,
                 "script": Path(a.script).read_text("utf-8")}]
    elif a.cmd == "sh":
        if not a.args:
            ap.error("需要命令")
        jobs = [{"type": "sh", "cmd": " ".join(a.args), "timeout": min(a.timeout, 1800)}]
    else:
        jobs = json.loads(Path(a.args[0]).read_text("utf-8"))
        if isinstance(jobs, dict):
            jobs = jobs.get("jobs", [])

    t0 = time.time()
    b, rid, sha, kp = submit(jobs)
    print(f"已提交请求 {rid}（{len(jobs)} 个任务，分支 {b}），等待 GitHub Actions …", file=sys.stderr)
    blob = wait_result(b, rid, sha, a.timeout)
    finish(b, rid, blob, kp, a.out, a.show)
    print(f"\n总耗时 {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
