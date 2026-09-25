"""
relay_client.py - run a fixed, whitelisted task against ONE machine from a
GitHub Actions runner (or any box that can reach the Cloudflare hostname).

Why this exists: some agent sandboxes can reach github.com but not Cloudflare.
An Actions runner can reach both, so it acts as the relay. See
docs/GITHUB_ACTIONS_RELAY.md for the full plan.

Design rules
  * No free-form commands. The task is chosen from TASKS below. Phase 1 is
    strictly read-only.
  * EVERY session's first call_tool is RunScript(language="python") reading
    C:\\mcp-bridge\\START_HERE\\README.md as UTF-8. Each Actions run is a new
    MCP session, so the rule is applied per run.
  * If the server has no RunScript tool (stock windows-mcp 0.8.5 has only
    "PowerShell"), STOP. Do not quietly fall back to something else.
  * The token only comes from env and never appears in output; every output
    line is redacted before it is printed or written.

Env
  PC_URL                    e.g. https://pc1.example.com/desktop/mcp
  PC_TOKEN                  desktop_token for that machine
  CF_ACCESS_CLIENT_ID       optional, Cloudflare Access service token
  CF_ACCESS_CLIENT_SECRET   optional

Usage
  python relay_client.py <task> [--out result.md] [--quiet]
  tasks: list_tools, read_start_here, verify              (read-only)
         rotate_preflight, rotate_status                   (read-only, see remote_ops.py)
         scrub_start_here, rotate_tokens                   (CHANGE the PC: need RELAY_APPROVED=yes)
"""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time

import httpx2  # NOTE: httpx2, not httpx -- mcp 2.x uses httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from remote_ops import SCRIPTS as OPS_SCRIPTS, WRITE_TASKS  # noqa: E402
SECRET_MARK = "NEW_TOKENS_JSON:"

START_DIR = r"C:\mcp-bridge\START_HERE"
README = START_DIR + r"\README.md"

# --------------------------------------------------------------------------
# Remote scripts (run on the Windows PC by RunScript, language="python").
# All of them only READ. None writes files, the registry or services.
# --------------------------------------------------------------------------

PY_READ_README = r'''
import hashlib
p = r"%s"
data = open(p, "rb").read()
print("SHA256:", hashlib.sha256(data).hexdigest(), "BYTES:", len(data))
print("-----BEGIN README-----")
print(data.decode("utf-8-sig"))
print("-----END README-----")
''' % README

PY_READ_NUMBERED = r'''
import os, re, hashlib
d = r"%s"
names = sorted(os.listdir(d))
print("DIR:", d)
for n in names:
    print("  ", n)
num = [n for n in names
       if re.match(r"^\d+", n) and os.path.isfile(os.path.join(d, n))]
num.sort(key=lambda n: (int(re.match(r"^(\d+)", n).group(1)), n))
LIMIT = 200_000
for n in num:
    p = os.path.join(d, n)
    data = open(p, "rb").read()
    print()
    print("=====FILE %%s  SHA256 %%s  BYTES %%d=====" %% (
        n, hashlib.sha256(data).hexdigest(), len(data)))
    if len(data) > LIMIT:
        print("[truncated to %%d bytes]" %% LIMIT)
        data = data[:LIMIT]
    try:
        print(data.decode("utf-8-sig"))
    except UnicodeDecodeError:
        print("[not UTF-8 text - skipped]")
print()
print("NUMBERED_FILES:", len(num))
''' % START_DIR

PY_VERIFY = r'''
import ctypes, getpass, json, os, platform, socket, subprocess
NO_WIN = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

def run(args):
    try:
        r = subprocess.run(args, capture_output=True, timeout=30,
                           creationflags=NO_WIN, stdin=subprocess.DEVNULL)
        return r.stdout.decode("utf-8", "replace")
    except Exception as e:
        return "ERR %s" % type(e).__name__

out = {}
out["COMPUTERNAME"] = os.environ.get("COMPUTERNAME")
out["socket.gethostname"] = socket.gethostname()
out["user"] = getpass.getuser()
out["USERDOMAIN"] = os.environ.get("USERDOMAIN")
out["os"] = platform.platform()
out["arch"] = platform.machine()

# machine.json: ONLY non-secret identity fields. Tokens are never read out.
ident = {}
for p in (r"C:\mcp-bridge\machine.json",):
    if os.path.exists(p):
        try:
            j = json.load(open(p, encoding="utf-8-sig"))
            ident = {k: j.get(k) for k in
                     ("machine_id", "label", "hostname", "bound_computer")}
        except Exception as e:
            ident = {"error": type(e).__name__}
out["machine.json(public fields)"] = ident
bc = (ident.get("bound_computer") or "").strip().lower()
out["bound_computer_matches"] = (bc == (out["COMPUTERNAME"] or "").lower()) if bc else None

# Admin: elevated token vs. merely being in the Administrators group.
try:
    out["IsUserAnAdmin(elevated)"] = bool(ctypes.windll.shell32.IsUserAnAdmin())
except Exception as e:
    out["IsUserAnAdmin(elevated)"] = "ERR %s" % type(e).__name__
g = run(["whoami", "/groups", "/fo", "csv", "/nh"])
out["in_Administrators_group(S-1-5-32-544)"] = "S-1-5-32-544" in g
if   "S-1-16-16384" in g: lvl = "System"
elif "S-1-16-12288" in g: lvl = "High (elevated)"
elif "S-1-16-8192"  in g: lvl = "Medium (not elevated)"
else: lvl = "unknown"
out["integrity_level"] = lvl
for k, v in out.items():
    print("%-40s %s" % (k, json.dumps(v, ensure_ascii=False)))
'''


# --------------------------------------------------------------------------
# client side
# --------------------------------------------------------------------------

class Out:
    """Collects output, redacting the token and any token-looking fields."""

    def __init__(self, secrets, quiet=False):
        self.secrets = [s for s in secrets if s]
        self.lines = []
        self.quiet = quiet

    def redact(self, text):
        for s in self.secrets:
            text = text.replace(s, "<REDACTED>")
        text = re.sub(r'("(?:bridge|desktop)_token"\s*:\s*")[^"]*(")',
                      r"\1<REDACTED>\2", text)
        text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9_\-\.=]{16,}",
                      r"\1<REDACTED>", text)
        return text

    def __call__(self, *parts):
        text = self.redact(" ".join(str(p) for p in parts))
        shown = []
        for ln in text.split("\n"):
            if SECRET_MARK in ln:
                # freshly generated tokens: kept in the --out file (sealed in
                # relay mode), never printed
                self.lines.append(ln[ln.index(SECRET_MARK):].strip())
                shown.append(SECRET_MARK + " <REDACTED - saved in the result file only>")
            else:
                self.lines.append(ln)
                shown.append(ln)
        if not self.quiet:
            print("\n".join(shown), flush=True)


def text_of(result):
    out = []
    for c in result.content or []:
        t = getattr(c, "text", None)
        if t is not None:
            out.append(t)
        elif getattr(c, "data", None) is not None:
            out.append(f"<{getattr(c, 'mime_type', 'binary')} {len(c.data)} b64 chars>")
    return "\n".join(out)


def leaf_errors(exc):
    """Flatten ExceptionGroups so the log shows the real cause."""
    if isinstance(exc, BaseExceptionGroup):
        out = []
        for e in exc.exceptions:
            out.extend(leaf_errors(e))
        return out
    return [exc]


def runscript_arg(tool):
    """Find the name of RunScript's code parameter from its schema."""
    props = (tool.input_schema or {}).get("properties", {})
    for k in ("script", "code", "source", "content", "command"):
        if k in props:
            return k
    cands = [k for k, v in props.items()
             if k != "language" and v.get("type") == "string"]
    return cands[0] if len(cands) == 1 else None


async def main(task, out_path, quiet=False):
    url = os.environ.get("PC_URL", "").strip()
    token = os.environ.get("PC_TOKEN", "").strip()
    if not url or not token:
        say = Out([token], quiet=quiet)
        say("ERROR: PC_URL / PC_TOKEN not set (GitHub secrets PC1_URL / "
            "PC1_DESKTOP_TOKEN missing?)")
        if out_path:
            os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
            open(out_path, "w", encoding="utf-8").write("\n".join(say.lines) + "\n")
        return 6
    headers = {"Authorization": f"Bearer {token}"}
    cid = os.environ.get("CF_ACCESS_CLIENT_ID", "")
    csec = os.environ.get("CF_ACCESS_CLIENT_SECRET", "")
    if cid and csec:
        headers["CF-Access-Client-Id"] = cid
        headers["CF-Access-Client-Secret"] = csec
    say = Out([token, csec], quiet=quiet)
    rc = 0

    say(f"# task: {task}")
    say(f"# target: {url}")
    t0 = time.monotonic()
    hc = httpx2.AsyncClient(
        headers=headers,
        timeout=httpx2.Timeout(connect=30, read=180, write=60, pool=30),
        transport=httpx2.AsyncHTTPTransport(retries=5),
    )
    try:
        async with hc:
            async with streamable_http_client(url, http_client=hc) as (r, w, *_):
                async with ClientSession(r, w) as s:
                    init = await s.initialize()
                    si = getattr(init, "server_info", None)
                    say(f"# connected in {time.monotonic() - t0:.1f}s, server="
                        f"{getattr(si, 'name', '?')} {getattr(si, 'version', '')}")

                    # list_tools is protocol metadata, not a remote tool call.
                    tools = {t.name: t for t in (await s.list_tools()).tools}
                    say(f"# tools ({len(tools)}): {', '.join(sorted(tools))}")

                    if task == "list_tools":
                        for n in sorted(tools):
                            say(f"\n## {n}\n{json.dumps(tools[n].input_schema, ensure_ascii=False)}")
                        # Deliberately no call_tool here.
                        return rc

                    rs = tools.get("RunScript")
                    if rs is None:
                        say("STOP: server has no 'RunScript' tool. The required "
                            "first call cannot be made. Not falling back. "
                            "Ask the owner how to proceed.")
                        return 3
                    arg = runscript_arg(rs)
                    if arg is None:
                        say("STOP: cannot determine RunScript's code parameter: "
                            + json.dumps(rs.input_schema, ensure_ascii=False))
                        return 3

                    if task in WRITE_TASKS and os.environ.get("RELAY_APPROVED") != "yes":
                        say(f"STOP: '{task}' changes the PC and needs the user's explicit "
                            "approval (RELAY_APPROVED=yes / ask.py --approved).")
                        return 7

                    async def py(code):
                        args = {"language": "python", arg: code}
                        if "timeout" in (rs.input_schema or {}).get("properties", {}):
                            args["timeout"] = 170
                        res = await s.call_tool("RunScript", args)
                        return text_of(res), bool(getattr(res, "is_error", False))

                    # ---- first remote tool call: ALWAYS the README ----
                    txt, err = await py(PY_READ_README)
                    if err or "-----BEGIN README-----" not in txt:
                        say("STOP: README read failed:\n" + txt)
                        return 4
                    if task == "read_start_here":
                        say("\n# ==== README.md ====\n" + txt)
                    else:
                        say("# README: " + txt.splitlines()[0])

                    if task == "read_start_here":
                        txt, err = await py(PY_READ_NUMBERED)
                        say("\n# ==== numbered files ====\n" + txt)
                        rc = 5 if err else 0
                    elif task == "verify":
                        t1 = time.monotonic()
                        txt, err = await py(PY_VERIFY)
                        say(f"\n# ==== verify (round trip {time.monotonic() - t1:.1f}s) ====\n" + txt)
                        rc = 5 if err else 0
                    elif task in OPS_SCRIPTS:
                        txt, err = await py(OPS_SCRIPTS[task])
                        say(f"\n# ==== {task} ====\n" + txt)
                        rc = 5 if err else 0
    except Exception as exc:  # never dump request objects (headers!) to logs
        for e in leaf_errors(exc):
            say(f"ERROR: {type(e).__name__}: {say.redact(str(e))[:500]}")
        rc = 2
    finally:
        if out_path:
            os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
            fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write("\n".join(say.lines) + "\n")
    return rc


TASKS = ("list_tools", "read_start_here", "verify", *OPS_SCRIPTS)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("task", choices=TASKS)
    ap.add_argument("--out", default="")
    ap.add_argument("--quiet", action="store_true",
                    help="print nothing; output only goes to --out (public CI logs)")
    a = ap.parse_args()
    if a.quiet and not a.out:
        ap.error("--quiet needs --out")
    if a.task == "rotate_tokens" and not a.out:
        ap.error("rotate_tokens needs --out (the new tokens are written only there)")
    sys.exit(asyncio.run(main(a.task, a.out, a.quiet)) or 0)
