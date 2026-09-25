r"""
remote_ops.py - scripts that run ON pc1 (via RunScript, language="python")
for the security hardening runbook (docs/SECURITY_RUNBOOK.md).

Tasks
  rotate_preflight   READ-ONLY checks + a detached local probe. Changes nothing
                     except writing a report folder under C:\mcp-bridge\backups\.
  rotate_status      READ-ONLY: shows the latest preflight probe / rotation status.
  scrub_start_here   WRITE: replaces the current tokens inside
                     C:\mcp-bridge\START_HERE\* with a placeholder (backup first).
  rotate_tokens      WRITE: backs up machine.json, writes two new random tokens,
                     starts a detached watchdog that restarts the stack and
                     ROLLS BACK automatically if the new desktop token is not
                     accepted locally. Prints the new tokens on one line that
                     the client treats as secret.

Design notes
  * Nothing here connects to 127.0.0.1:8021 (single-instance lock). Listening
    ports are read from `netstat -ano`, as START_HERE asks.
  * The MCP server handles one call at a time, so anything that has to talk to
    the local MCP endpoint (probes) or restart the stack runs in a DETACHED
    process created through WMI (Win32_Process.Create): it is not a child of
    windows-mcp, survives the restart, and has no console window.
  * Detached helpers read tokens from machine.json / its backup on the PC
    itself; no token is passed on a command line.
"""

# ---------------------------------------------------------------------------
# shared helpers, prepended to every remote script
# ---------------------------------------------------------------------------
COMMON = r'''
import json, os, subprocess, sys, time
BASE = r"C:\mcp-bridge"
MJ = os.path.join(BASE, "machine.json")
BACKUPS = os.path.join(BASE, "backups")
NOWIN = 0x08000000

def run(args, t=60):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=t,
                              creationflags=NOWIN, stdin=subprocess.DEVNULL,
                              encoding="utf-8", errors="replace")
    except Exception as e:
        print("RUN_ERROR", args[0], type(e).__name__)
        return None

def pythonw():
    d = os.path.dirname(sys.executable)
    for n in ("pythonw.exe", "python.exe"):
        p = os.path.join(d, n)
        if os.path.exists(p):
            return p
    return sys.executable

def spawn_detached(script_path):
    """Start `pythonw script` via WMI so it is NOT a child of windows-mcp."""
    cmd = '"%s" "%s"' % (pythonw(), script_path)
    ps = ("$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create "
          "-Arguments @{CommandLine='%s'}; '{0} {1}' -f $r.ReturnValue, $r.ProcessId") % cmd
    r = run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], 90)
    out = (r.stdout.strip() if r else "")
    ok = out.split(" ")[0] == "0"
    return ok, out

def stamp():
    import secrets as _s
    return time.strftime("%Y%m%d-%H%M%S-") + _s.token_hex(2)

def load_mj(path=MJ):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)

def listen_set():
    """Listening TCP ports. netstat first; PowerShell if its output is localized."""
    r = run(["netstat", "-ano", "-p", "TCP"])
    ports = set()
    if r and "LISTENING" in r.stdout.upper():
        for line in r.stdout.splitlines():
            p = line.split()
            if len(p) >= 4 and p[3].upper() == "LISTENING" and ":" in p[1]:
                try:
                    ports.add(int(p[1].rsplit(":", 1)[1]))
                except ValueError:
                    pass
        return ports
    r = run(["powershell", "-NoProfile", "-NonInteractive", "-Command",
             "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | "
             "Select-Object -ExpandProperty LocalPort"], 60)
    for x in (r.stdout.split() if r else []):
        if x.isdigit():
            ports.add(int(x))
    return ports

def listening(port):
    return port in listen_set()
'''

# ---------------------------------------------------------------------------
# detached helper: local probe + port/stack functions (used by preflight and
# by the rotation watchdog)
# ---------------------------------------------------------------------------
HELPER_LIB = r'''
import json, os, subprocess, time, urllib.request, urllib.error
BASE = r"C:\mcp-bridge"
NOWIN = 0x08000000
HERE = os.path.dirname(os.path.abspath(__file__))

def run(args, t=60):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=t,
                              creationflags=NOWIN, stdin=subprocess.DEVNULL,
                              encoding="utf-8", errors="replace")
    except Exception:
        return None

def listen_set():
    """Listening TCP ports. netstat first; PowerShell if its output is localized."""
    r = run(["netstat", "-ano", "-p", "TCP"])
    ports = set()
    if r and "LISTENING" in r.stdout.upper():
        for line in r.stdout.splitlines():
            p = line.split()
            if len(p) >= 4 and p[3].upper() == "LISTENING" and ":" in p[1]:
                try:
                    ports.add(int(p[1].rsplit(":", 1)[1]))
                except ValueError:
                    pass
        return ports
    r = run(["powershell", "-NoProfile", "-NonInteractive", "-Command",
             "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | "
             "Select-Object -ExpandProperty LocalPort"], 60)
    for x in (r.stdout.split() if r else []):
        if x.isdigit():
            ports.add(int(x))
    return ports

def listening(port):
    return port in listen_set()

def probe(token, port=8010, path="/desktop/mcp"):
    """HTTP status of an MCP initialize with this bearer token (None = no answer)."""
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                       "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                                  "clientInfo": {"name": "pc1-runbook", "version": "1"}}}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:%d%s" % (port, path), data=body, method="POST",
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json",
                 "Accept": "application/json, text/event-stream"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None

def stack_task_exists():
    r = run(["schtasks", "/query", "/tn", "MCP-Stack"])
    return bool(r and r.returncode == 0)

def stop_stack(own_pid):
    run(["schtasks", "/end", "/tn", "MCP-Stack"])
    ps = (r"$b=[regex]::Escape('C:\mcp-bridge'); Get-CimInstance Win32_Process | "
          r"Where-Object { $_.CommandLine -and $_.CommandLine -match $b -and "
          r"$_.CommandLine -match 'supervisor\.py|bridge_server\.py|windows_mcp|windows-mcp|cloudflared' "
          r"-and $_.ProcessId -ne %d } | "
          r"ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }") % own_pid
    run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], 120)
    for _ in range(40):
        ls = listen_set()
        if not ({8000, 8010, 8021} & ls):
            return True
        time.sleep(2)
    return False

def start_stack():
    if stack_task_exists():
        r = run(["schtasks", "/run", "/tn", "MCP-Stack"])
        if r and r.returncode == 0:
            return "schtasks"
    # fallback: the documented launcher (may show a console briefly)
    run(["cmd", "/c", os.path.join(BASE, "launch.cmd")], 180)
    return "launch.cmd"

def wait_up(timeout=240):
    t0 = time.time()
    while time.time() - t0 < timeout:
        ls = listen_set()
        if 8010 in ls and 8000 in ls:
            return True
        time.sleep(3)
    return False
'''

# ---------------------------------------------------------------------------
# rotate_preflight (read-only on the bridge; writes a report folder)
# ---------------------------------------------------------------------------
PREFLIGHT_PROBE = HELPER_LIB + r'''
import secrets
time.sleep(6)                      # let the RunScript call that spawned us return
res = {"at": time.strftime("%Y-%m-%d %H:%M:%S")}
try:
    mj = json.load(open(os.path.join(BASE, "machine.json"), encoding="utf-8-sig"))
    ls = listen_set()
    res["listening"] = {p: (p in ls) for p in (8000, 8010, 8021)}
    res["probe_current_desktop_token"] = probe(mj["desktop_token"])
    res["probe_bogus_token"] = probe(secrets.token_urlsafe(32))
    cur, bog = res["probe_current_desktop_token"], res["probe_bogus_token"]
    res["probe_logic_usable"] = (cur not in (None, 401, 403)) and bog in (401, 403)
except Exception as e:
    res["error"] = repr(e)
json.dump(res, open(os.path.join(HERE, "probe.json"), "w", encoding="utf-8"), indent=1)
'''

PY_ROTATE_PREFLIGHT = COMMON + r'''
rep = {}
try:
    mj = load_mj()
    rep["machine.json readable"] = True
    rep["has bridge_token/desktop_token"] = bool(mj.get("bridge_token")) and bool(mj.get("desktop_token"))
    rep["machine_id"] = mj.get("machine_id")
    rep["bound_computer == COMPUTERNAME"] = (str(mj.get("bound_computer", "")).lower()
                                             == os.environ.get("COMPUTERNAME", "").lower())
except Exception as e:
    rep["machine.json readable"] = "ERROR %s" % type(e).__name__
t = run(["schtasks", "/query", "/tn", "MCP-Stack", "/v", "/fo", "LIST"])
if t and t.returncode == 0:
    keep = ("TaskName", "Status", "Run As User", "Task To Run", "Logon Mode", "Scheduled Task State")
    rep["MCP-Stack"] = {k.strip(): v.strip() for k, _, v in
                        (l.partition(":") for l in t.stdout.splitlines())
                        if k.strip() in keep}
else:
    rep["MCP-Stack"] = "MISSING (restart would fall back to launch.cmd)"
rep["launch.cmd exists"] = os.path.exists(os.path.join(BASE, "launch.cmd"))
rep["pythonw for helpers"] = pythonw()
ls = listen_set()
rep["listening 8000/8010/8021"] = [p in ls for p in (8000, 8010, 8021)]
rep["port detection usable"] = 8010 in ls
d = os.path.join(BACKUPS, "rotate-preflight-" + stamp())
try:
    os.makedirs(d)
    open(os.path.join(d, "probe.py"), "w", encoding="utf-8").write(PROBE_SRC)
    ok, out = spawn_detached(os.path.join(d, "probe.py"))
    rep["backups writable"] = True
    rep["detached spawn via WMI"] = "ok (%s)" % out if ok else "FAILED (%s)" % out
    rep["probe report (read with rotate_status in ~30s)"] = d
except Exception as e:
    rep["backups writable"] = "ERROR %s" % type(e).__name__
for k, v in rep.items():
    print("%-48s %s" % (k, json.dumps(v, ensure_ascii=False)))
'''.replace("PROBE_SRC", repr(PREFLIGHT_PROBE))

# ---------------------------------------------------------------------------
# rotate_status (read-only)
# ---------------------------------------------------------------------------
PY_ROTATE_STATUS = COMMON + r'''
def latest(prefix):
    if not os.path.isdir(BACKUPS):
        return None
    c = sorted(n for n in os.listdir(BACKUPS) if n.startswith(prefix))
    return os.path.join(BACKUPS, c[-1]) if c else None
for prefix, fname in (("rotate-preflight-", "probe.json"), ("rotate-tokens-", "status.json")):
    d = latest(prefix)
    print("==", prefix, d)
    if d and os.path.exists(os.path.join(d, fname)):
        print(open(os.path.join(d, fname), encoding="utf-8").read())
    elif d:
        print("(no %s yet - helper still running or failed to start)" % fname)
print("== listening now")
ls = listen_set()
for p in (8000, 8010, 8021):
    print(p, "LISTENING" if p in ls else "not listening")
'''

# ---------------------------------------------------------------------------
# scrub_start_here (WRITE, backup first)
# ---------------------------------------------------------------------------
PY_SCRUB_START_HERE = COMMON + r'''
import shutil
mj = load_mj()
toks = [t for t in (mj.get("bridge_token"), mj.get("desktop_token")) if t and len(t) >= 16]
if not toks:
    sys.exit("no tokens found in machine.json - nothing to scrub")
PH = "<已移除：令牌只保存在本机 machine.json 和 GitHub 仓库 Secrets 中>".encode("utf-8")
pats = [(t.encode(), PH) for t in toks] + [((t[:6] + "...").encode(), "<已移除>".encode("utf-8")) for t in toks]
d = os.path.join(BASE, "START_HERE")
bk = os.path.join(BACKUPS, "scrub-start-here-" + stamp())
changed = []
for n in sorted(os.listdir(d)):
    p = os.path.join(d, n)
    if not os.path.isfile(p):
        continue
    raw = open(p, "rb").read()
    new = raw
    for a, b in pats:
        new = new.replace(a, b)          # byte-level: keeps BOM / CRLF / encoding
    if new != raw:
        os.makedirs(bk, exist_ok=True)
        shutil.copy2(p, os.path.join(bk, n))
        tmp = p + ".tmp-scrub"
        open(tmp, "wb").write(new)
        os.replace(tmp, p)
        if any(t.encode() in open(p, "rb").read() for t in toks):
            sys.exit("VERIFY FAILED for %s - restore from %s" % (n, bk))
        changed.append(n)
print("CHANGED_FILES:", json.dumps(changed, ensure_ascii=False))
print("BACKUP_DIR:", bk if changed else None)
hits = []
skip = {"backups", "venv-desktop", "python", "offline", "__pycache__", "node_modules", ".git"}
for root, dirs, files in os.walk(BASE):
    dirs[:] = [x for x in dirs if x not in skip]
    for f in files:
        fp = os.path.join(root, f)
        if os.path.normcase(fp) == os.path.normcase(MJ):
            continue
        try:
            if os.path.getsize(fp) > 5000000:
                continue
            b = open(fp, "rb").read()
        except Exception:
            continue
        if any(t.encode() in b for t in toks):
            hits.append(os.path.relpath(fp, BASE))
print("OTHER_FILES_CONTAINING_CURRENT_TOKENS (not modified):", json.dumps(hits, ensure_ascii=False))
'''

# ---------------------------------------------------------------------------
# rotate_tokens (WRITE) + its watchdog
# ---------------------------------------------------------------------------
WATCHDOG = HELPER_LIB + r'''
import shutil
ST = {"started": time.strftime("%Y-%m-%d %H:%M:%S"), "steps": [], "result": "running"}
def note(s):
    ST["steps"].append(time.strftime("%H:%M:%S ") + s)
    json.dump(ST, open(os.path.join(HERE, "status.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
def rollback(why):
    note("ROLLBACK (%s): restoring previous machine.json" % why)
    shutil.copy2(os.path.join(HERE, "machine.json"), os.path.join(BASE, "machine.json"))
    note("stopped=%s" % stop_stack(os.getpid()))
    note("started via %s" % start_stack())
    note("after rollback ports up=%s" % wait_up())

try:
    note("waiting 10s so the RunScript call can return")
    time.sleep(10)
    new_tok = json.load(open(os.path.join(BASE, "machine.json"), encoding="utf-8-sig"))["desktop_token"]
    old_tok = json.load(open(os.path.join(HERE, "machine.json"), encoding="utf-8-sig"))["desktop_token"]
    note("stopping stack"); note("stopped=%s" % stop_stack(os.getpid()))
    note("started via %s" % start_stack())
    up = wait_up(); note("ports up=%s" % up)
    n = o = None
    for i in range(12):                 # old CPU: listening != ready; retry ~2 min
        if not up:
            break
        time.sleep(8)
        n = probe(new_tok)
        if n is not None:
            o = probe(old_tok)
            break
    note("probe new=%s old=%s" % (n, o))
    good = up and n not in (None, 401, 403) and o in (401, 403)
    inconclusive = up and n == o and n not in (None, 401, 403)
    if good:
        ST["result"] = "ok"
    elif inconclusive:
        ST["result"] = "inconclusive_kept_new"
    else:
        rollback("new token not accepted")
        ST["result"] = "rolled_back"
except Exception as e:
    note("ERROR %r" % (e,))
    try:
        rollback("unexpected error")
        ST["result"] = "error_rolled_back"
    except Exception as e2:
        note("ROLLBACK FAILED %r - restore machine.json from this folder by hand" % (e2,))
        ST["result"] = "error_rollback_failed"
note("done")
'''

PY_ROTATE_TOKENS = COMMON + r'''
import secrets, shutil
bk = os.path.join(BACKUPS, "rotate-tokens-" + stamp())
os.makedirs(bk)
shutil.copy2(MJ, os.path.join(bk, "machine.json"))
mj = load_mj()
nb, nd = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
mj["bridge_token"], mj["desktop_token"] = nb, nd
tmp = MJ + ".tmp-rotate"
with open(tmp, "w", encoding="utf-8", newline="\n") as f:     # UTF-8, no BOM
    json.dump(mj, f, indent=2, ensure_ascii=False)
chk = json.load(open(tmp, encoding="utf-8"))
if chk.get("desktop_token") != nd or chk.get("bridge_token") != nb:
    os.remove(tmp)
    sys.exit("verify of new machine.json failed - nothing changed")
os.replace(tmp, MJ)
open(os.path.join(bk, "watchdog.py"), "w", encoding="utf-8").write(WATCHDOG_SRC)
ok, out = spawn_detached(os.path.join(bk, "watchdog.py"))
if not ok:
    shutil.copy2(os.path.join(bk, "machine.json"), MJ)
    sys.exit("could not start watchdog (%s) - machine.json restored, nothing changed" % out)
print("BACKUP_DIR:", bk)
print("WATCHDOG:", out)
print("The stack restarts in ~10s. Check with rotate_status after ~90s.")
print("NEW_TOKENS_JSON: " + json.dumps({"bridge": nb, "desktop": nd}))
'''.replace("WATCHDOG_SRC", repr(WATCHDOG))

WRITE_TASKS = ("scrub_start_here", "rotate_tokens")
SCRIPTS = {
    "rotate_preflight": PY_ROTATE_PREFLIGHT,
    "rotate_status": PY_ROTATE_STATUS,
    "scrub_start_here": PY_SCRUB_START_HERE,
    "rotate_tokens": PY_ROTATE_TOKENS,
}
