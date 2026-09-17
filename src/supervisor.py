#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
supervisor.py - watchdog for the three long-running local processes.

Responsibilities:
  1. local-bridge   bridge_server.py   -> 127.0.0.1:8000  files + shell
  2. desktop-bridge windows-mcp serve  -> 127.0.0.1:8010  desktop automation
  3. tunnel         cloudflared        -> Cloudflare Tunnel, routed by path
  4. health check every 15s; respawn anything that died
  5. per-component logs: bridge.log / desktop.log / tunnel.log

Requires no interactive session; can be launched at logon.
"""

import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time

BASE = os.path.dirname(os.path.abspath(__file__))


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] supervisor: {msg}\n"
    try:
        with open(os.path.join(BASE, "supervisor.log"), "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass



# ---- Process 1: the local bridge (files + shell) ----
# Interpreter discovery: no absolute paths are hardcoded. Candidates are probed
# in priority order and each one is VERIFIED by actually importing the packages
# bridge_server needs -- a path existing proves nothing about its dependencies.
#   1) BASE\python\                  -- bundled by install.cmd on a new machine
#   2) the interpreter running this supervisor (it clearly works)
#   3) MCP_EXTRA_PYTHON, if set (an interpreter provided by some other tool)
#   4) pythonw / python on PATH
CREATE_NO_WINDOW = 0x08000000
NEW_GROUP = 0x00000200

_NEEDED = ("mcp", "uvicorn", "starlette")


def _pyw_of(exe):
    """Prefer a sibling pythonw.exe: GUI subsystem, so no console window."""
    if not exe:
        return None
    w = os.path.join(os.path.dirname(exe), "pythonw.exe")
    return w if os.path.exists(w) else exe


def _usable(exe):
    """Actually run an import to confirm this interpreter can host bridge_server."""
    if not exe or not os.path.exists(exe):
        return False
    try:
        r = subprocess.run(
            [exe, "-c", "import " + ",".join(_NEEDED)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, timeout=25,
            creationflags=CREATE_NO_WINDOW,
        )
        return r.returncode == 0
    except Exception:
        return False


def _find_python():
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    cands = [
        os.path.join(BASE, "python", "pythonw.exe"),
        os.path.join(BASE, "python", "python.exe"),
        _pyw_of(sys.executable),
        sys.executable,
        # Optional extra location, e.g. a Python shipped by some other tool.
        # Set MCP_EXTRA_PYTHON to an interpreter path to add it to the search.
        os.environ.get("MCP_EXTRA_PYTHON"),
        shutil.which("pythonw"),
        shutil.which("python"),
    ]
    seen, ordered = set(), []
    for c in cands:
        if c and c.lower() not in seen:
            seen.add(c.lower())
            ordered.append(c)
    for c in ordered:
        if _usable(c):
            return c, "verified"
    # nothing verified: fall back to ourselves so the supervisor still runs
    return _pyw_of(sys.executable) or sys.executable, "fallback"


# Deliberately NOT resolved at import time: probing spawns several Python
# processes (seconds each). A losing second instance must exit fast, so this is
# resolved in main() *after* the singleton lock is held. See _init_runtime().
PYTHON = None
_PY_HOW = "unresolved"
BRIDGE_PY = os.path.join(BASE, "bridge_server.py")
BRIDGE_LOG = os.path.join(BASE, "bridge.log")
BRIDGE_PORT = 8000
BRIDGE_ROOT = os.path.join(BASE, "bridge-workspace")

# ---------------------------------------------------------------------------
# Machine identity (machine.json) -- one per PC, NEVER shipped in the installer.
#
# Why this is separate: tokens / tunnel / hostname are this machine's ID card.
# Cloning a whole install to a second PC would make both run the same Cloudflare
# tunnel, and Cloudflare treats them as replicas, routing each request to a
# RANDOM one of them -- you would not know which machine you are driving.
# ---------------------------------------------------------------------------
MACHINE_FILE = os.path.join(BASE, "machine.json")

_DEFAULT_ID = {
    "machine_id": "",          # short id used by clients, e.g. pc1 / office
    "label": "",               # human-readable name
    "hostname": "",            # public hostname, e.g. pc1.example.com
    "tunnel_name": "",
    "bridge_token": "",
    "desktop_token": "",
    "bound_computer": "",      # COMPUTERNAME this identity belongs to
}


def load_identity():
    """Load machine.json, filling in and persisting any missing fields.
    Tokens are generated on first run."""
    data = dict(_DEFAULT_ID)
    if os.path.exists(MACHINE_FILE):
        # utf-8-sig: PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM,
        # which plain utf-8 json.load rejects.
        try:
            with open(MACHINE_FILE, "r", encoding="utf-8-sig") as f:
                data.update(json.load(f) or {})
        except Exception as exc:
            # Do NOT silently regenerate: that would mint new tokens and drop the
            # hostname, breaking every client. Fail loudly instead.
            log(f"FATAL: machine.json exists but is unreadable ({exc!r}).")
            log("Fix the file or delete it to regenerate. Refusing to start.")
            raise SystemExit(2)
    changed = False
    cn = os.environ.get("COMPUTERNAME", "") or socket.gethostname()
    if not data.get("machine_id"):
        data["machine_id"] = cn.lower() or "pc"
        changed = True
    if not data.get("label"):
        data["label"] = cn
        changed = True
    if not data.get("bound_computer"):
        data["bound_computer"] = cn
        changed = True
    for k in ("bridge_token", "desktop_token"):
        if not data.get(k):
            data[k] = secrets.token_urlsafe(32)
            changed = True
    if changed:
        try:
            with open(MACHINE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            log(f"machine.json written (id={data['machine_id']})")
        except OSError as exc:
            log(f"cannot write machine.json: {exc!r}")
    return data


# Same reasoning as PYTHON above: load_identity() can WRITE machine.json on
# first run, so two racing instances could fight over it. Resolved under the lock.
IDENTITY = {}
MACHINE_ID = ""
BRIDGE_TOKEN = ""

# ---- Process 2: Windows-MCP, the desktop automation backend ----
#  https://github.com/CursorTouch/Windows-MCP  (MIT, pip package: windows-mcp)
DESKTOP_EXE = os.path.join(BASE, "venv-desktop", "Scripts", "windows-mcp.exe")
_DESK_PYW = os.path.join(BASE, "venv-desktop", "Scripts", "pythonw.exe")
DESKTOP_LOG = os.path.join(BASE, "desktop.log")
DESKTOP_PORT = 8010
DESKTOP_TOKEN = ""
# Mount the MCP endpoint at /desktop/mcp. cloudflared does NOT strip path
# prefixes, so the backend must mount itself there for the public URL to match.
DESKTOP_MCP_PATH = "/desktop/mcp"

# ---- Process 3: the Cloudflare tunnel ----
CLOUDFLARED = os.path.join(BASE, "cloudflared.exe")
CONFIG = os.path.join(BASE, "config.yml")
TUNNEL_LOG = os.path.join(BASE, "tunnel.log")

CHECK_INTERVAL = 15
STARTUP_GRACE = 60        # don't port-check a component for the first 60s
STABLE_AFTER = 120        # running this long clears the backoff counter
BACKOFF_BASE = 5
BACKOFF_MAX = 300
MAX_LOG_BYTES = 10 * 1024 * 1024

ENV = dict(os.environ)
ENV["BRIDGE_ROOT"] = BRIDGE_ROOT
ENV["PYTHONIOENCODING"] = "utf-8"
ENV["PYTHONUTF8"] = "1"
ENV["ANONYMIZED_TELEMETRY"] = "false"   # disable windows-mcp PostHog telemetry

# Put a portable PowerShell 7 on the child PATH.
# windows-mcp does:
#     shell = shell or ("pwsh" if shutil.which("pwsh") else "powershell")
# Windows PowerShell 5.1 cold-starts in 5-6s per call;
# with pwsh present that drops to 1-2s.
PWSH_DIR = os.path.join(BASE, "pwsh")
if os.path.isdir(PWSH_DIR):
    ENV["PATH"] = PWSH_DIR + os.pathsep + ENV.get("PATH", "")

# Per-phase Snapshot timing logs.
# Kept for performance visibility; costs one extra log line per Snapshot.
ENV["WINDOWS_MCP_PROFILE_SNAPSHOT"] = "1"

# CREATE_NO_WINDOW: child gets no console -> no white conhost window.
# It conflicts with DETACHED_PROCESS(0x8): passing both gives error 87.
# Constants are defined above because _usable() needs them.


def health_ok(url: str, timeout: int = 5) -> bool:
    """A real request, not just a TCP connect."""
    try:
        import urllib.request
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return 200 <= r.status < 400
    except Exception:
        return False


def rotate_logs():
    """Logs are append-only forever; a long-lived box accumulates hundreds of MB."""
    for name in ("supervisor.log", "bridge.log", "desktop.log", "tunnel.log"):
        p = os.path.join(BASE, name)
        try:
            if os.path.exists(p) and os.path.getsize(p) > MAX_LOG_BYTES:
                old = p + ".1"
                if os.path.exists(old):
                    os.remove(old)
                os.replace(p, old)
        except OSError:
            pass


def port_open(port: int, host: str = "127.0.0.1") -> bool:
    s = socket.socket()
    s.settimeout(2)
    try:
        return s.connect_ex((host, port)) == 0
    finally:
        s.close()


def spawn(cmd, logfile, tag, extra_env=None, prev=None):
    # Close the previous run's log handle, otherwise a component that crash-loops
    # every 15s leaks thousands of file handles a day.
    if prev is not None:
        try:
            if prev.stdout:
                prev.stdout.close()
        except Exception:
            pass
    lf = open(logfile, "a", encoding="utf-8", errors="replace")
    env = ENV if not extra_env else {**ENV, **extra_env}
    proc = subprocess.Popen(
        cmd, cwd=BASE, env=env, stdin=subprocess.DEVNULL,
        stdout=lf, stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW | NEW_GROUP, close_fds=True,
    )
    proc.stdout = lf          # keep a reference so the next spawn can close it
    log(f"{tag} started pid={proc.pid}")
    return proc


def start_bridge(prev=None):
    return spawn([PYTHON, BRIDGE_PY], BRIDGE_LOG, "bridge", prev=prev)


_DESKTOP_HEAD = None


def _desktop_head():
    r"""Decide how to launch windows_mcp. Two layouts are supported:
      A) BASE\venv-desktop\  -- a virtualenv (upgrade path / existing installs)
      B) BASE\python\        -- windows-mcp installed straight into the
         interpreter, because the Python EMBEDDABLE BUILD HAS NO venv MODULE
         ("No module named venv"), so the installer cannot create one.
    pythonw.exe is preferred: GUI subsystem, no console window."""
    global _DESKTOP_HEAD
    if _DESKTOP_HEAD is not None:
        return _DESKTOP_HEAD
    cands = []
    for d in (os.path.join(BASE, "venv-desktop", "Scripts"),
              os.path.join(BASE, "python", "Scripts"),
              os.path.join(BASE, "python")):
        cands.append((os.path.join(d, "pythonw.exe"), True))
        cands.append((os.path.join(d, "python.exe"), True))
        cands.append((os.path.join(d, "windows-mcp.exe"), False))
    # last resort: the main interpreter (already dependency-verified)
    cands.append((PYTHON, True))
    for exe, as_module in cands:
        if not exe or not os.path.exists(exe):
            continue
        if not as_module:
            _DESKTOP_HEAD = [exe]
            return _DESKTOP_HEAD
        try:
            r = subprocess.run([exe, "-c", "import windows_mcp"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               stdin=subprocess.DEVNULL, timeout=25,
                               creationflags=CREATE_NO_WINDOW)
            if r.returncode == 0:
                _DESKTOP_HEAD = [exe, "-m", "windows_mcp"]
                return _DESKTOP_HEAD
        except Exception:
            continue
    log("WARNING: no interpreter with windows_mcp found; falling back")
    _DESKTOP_HEAD = [DESKTOP_EXE]
    return _DESKTOP_HEAD


def start_desktop(prev=None):
    head = _desktop_head()
    return spawn(
        head + ["serve",
         "--transport", "streamable-http",
         "--host", "127.0.0.1",
         "--port", str(DESKTOP_PORT),
         # Bound to 127.0.0.1 (only the tunnel reaches it); this flag only skips the
         # Host check, otherwise TrustedHostMiddleware returns 421 for the public Host.
         "--allow-insecure-remote",
         # Stateless: clients survive a backend restart without re-handshaking.
         "--stateless-http"],
        DESKTOP_LOG, "desktop", prev=prev,
        # Token via env, not argv: any process on the box can read another's
        # command line (launch.cmd itself does exactly that).
        # FASTMCP_* is scoped here too, so it can never leak into the bridge.
        extra_env={
            "WINDOWS_MCP_AUTH_KEY": DESKTOP_TOKEN,
            "FASTMCP_STREAMABLE_HTTP_PATH": DESKTOP_MCP_PATH,
            "FASTMCP_JSON_RESPONSE": "1",
        },
    )


def ensure_config():
    """credentials-file in config.yml is an absolute path, so it breaks when the
    install moves. Rewrite it to BASE\tunnel.json at boot. No-op if unchanged."""
    try:
        if not os.path.exists(CONFIG):
            return
        with open(CONFIG, "r", encoding="utf-8") as f:
            text = f.read()
        want = os.path.join(BASE, "tunnel.json")
        out, changed = [], False
        for line in text.splitlines(True):
            if line.lstrip().lower().startswith("credentials-file:"):
                cur = line.split(":", 1)[1].strip()
                if os.path.normcase(cur) != os.path.normcase(want):
                    nl = "\n" if line.endswith("\n") else ""
                    line = f"credentials-file: {want}{nl}"
                    changed = True
            out.append(line)
        if changed:
            with open(CONFIG, "w", encoding="utf-8") as f:
                f.write("".join(out))
            log(f"config.yml credentials-file -> {want}")
    except Exception as exc:
        log(f"ensure_config error: {exc!r}")


def tunnel_allowed():
    """Anti-cross-wiring guard. machine.json records which host owns this
    identity. If the folder was cloned to another PC the COMPUTERNAME will not
    match, so refuse to start the tunnel (local 8000/8010 still work).
    A new machine should run install.cmd to get its own tunnel."""
    bound = (IDENTITY.get("bound_computer") or "").strip()
    cur = os.environ.get("COMPUTERNAME", "") or socket.gethostname()
    if not bound or bound.lower() == cur.lower():
        return True
    log("=" * 64)
    log(f"TUNNEL BLOCKED: machine.json belongs to '{bound}', this host is '{cur}'.")
    log("This copy was cloned from another PC. Two hosts sharing one tunnel ID")
    log("makes Cloudflare route requests to a RANDOM one of them.")
    log("Fix: run  install.cmd --new-identity  to create this PC's own tunnel.")
    log("=" * 64)
    return False


def start_tunnel(prev=None):
    if not tunnel_allowed():
        return None
    ensure_config()
    # The tunnel is optional: a missing cloudflared.exe must not take down the
    # supervisor and orphan the two local servers.
    try:
        return spawn([CLOUDFLARED, "tunnel", "--config", CONFIG, "run"],
                     TUNNEL_LOG, "tunnel", prev=prev)
    except OSError as exc:
        log(f"tunnel could not start ({exc!r}); local ports still served")
        return None




# Single-instance lock: bind a local port. A second instance fails to bind.
# More reliable than a PID file: the kernel releases it when the process dies.
SINGLETON_PORT = 8021
_LOCK = None


def acquire_singleton() -> bool:
    global _LOCK
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # deliberately no SO_REUSEADDR: "already taken" must fail
        s.bind(("127.0.0.1", SINGLETON_PORT))
        s.listen(1)
    except OSError:
        s.close()
        return False
    _LOCK = s          # held globally for the lifetime of the process
    return True


def _init_runtime():
    """Resolve everything expensive/stateful. Called only after the lock is held."""
    global PYTHON, _PY_HOW, IDENTITY, MACHINE_ID, BRIDGE_TOKEN, DESKTOP_TOKEN
    IDENTITY = load_identity()
    MACHINE_ID = IDENTITY["machine_id"]
    BRIDGE_TOKEN = IDENTITY["bridge_token"]
    DESKTOP_TOKEN = IDENTITY["desktop_token"]
    PYTHON, _PY_HOW = _find_python()

    ENV["BRIDGE_TOKEN"] = BRIDGE_TOKEN

    # Tell bridge_server which public Host to accept. Without this the
    # DNS-rebinding guard rejects tunnelled requests with 421, because its
    # built-in default is only a placeholder. The guard stays ON; we merely
    # whitelist the hostname we own.
    pub = (IDENTITY.get("hostname") or "").strip()
    if pub:
        ENV["BRIDGE_ALLOWED_HOSTS"] = ",".join([
            pub, f"{pub}:*", "127.0.0.1", "127.0.0.1:*", "localhost", "localhost:*"])
        ENV["BRIDGE_ALLOWED_ORIGINS"] = ",".join([
            f"https://{pub}", "http://127.0.0.1:*", "http://localhost:*"])
    else:
        log("WARNING: machine.json has no hostname; /mcp will 421 through the "
            "tunnel. Set it and restart.")


def main() -> int:
    # Take the lock FIRST. Interpreter probing and identity loading are slow and
    # can write machine.json, so a losing instance must bail out before either.
    if not acquire_singleton():
        log("another supervisor is already running, exiting")
        return 0
    rotate_logs()
    _init_runtime()
    log("supervisor boot")
    log(f"machine={MACHINE_ID} label={IDENTITY.get('label')} "
        f"host={IDENTITY.get('hostname') or '(unset)'}")
    log(f"python={PYTHON} ({_PY_HOW})")
    log("desktop=" + " ".join(_desktop_head()))

    comp = {
        "bridge":  {"proc": None, "start": start_bridge,  "port": BRIDGE_PORT,
                    "health": f"http://127.0.0.1:{BRIDGE_PORT}/health"},
        "desktop": {"proc": None, "start": start_desktop, "port": DESKTOP_PORT,
                    "health": None},
        "tunnel":  {"proc": None, "start": start_tunnel,  "port": None,
                    "health": None},
    }
    for c in comp.values():
        c.update(fails=0, next_try=0.0, started_at=0.0)

    def boot(name, wait):
        c = comp[name]
        c["proc"] = c["start"](prev=c["proc"])
        c["started_at"] = time.monotonic()
        time.sleep(wait)

    boot("bridge", 10)
    boot("desktop", 14)
    boot("tunnel", 0)

    while True:
        time.sleep(CHECK_INTERVAL)
        now = time.monotonic()
        for name, c in comp.items():
            try:
                proc, dead, why = c["proc"], False, ""
                if proc is None:
                    dead, why = True, "not running"
                elif proc.poll() is not None:
                    dead, why = True, f"exited code={proc.returncode}"
                elif c["port"] is not None and now - c["started_at"] > STARTUP_GRACE:
                    # Grace period first: a cold import of mcp/uvicorn can take
                    # well over 10s on a slow disk, and killing it mid-start
                    # produces an endless kill/restart loop.
                    if not port_open(c["port"]):
                        dead, why = True, f"port {c['port']} not listening"
                    elif c["health"] and not health_ok(c["health"]):
                        # TCP accept alone proves nothing: a wedged event loop
                        # still has the kernel completing handshakes.
                        dead, why = True, "health check failed"

                if not dead:
                    if c["fails"] and now - c["started_at"] > STABLE_AFTER:
                        c["fails"] = 0      # survived long enough; reset backoff
                    continue

                if now < c["next_try"]:
                    continue

                c["fails"] += 1
                delay = min(BACKOFF_BASE * (2 ** (c["fails"] - 1)), BACKOFF_MAX)
                c["next_try"] = now + delay
                log(f"{name} {why}, restarting (attempt {c['fails']}, "
                    f"next retry in >={delay}s if it fails again)")
                if proc is not None and proc.poll() is None:
                    try:
                        proc.kill()
                    except OSError:
                        pass
                c["proc"] = c["start"](prev=c["proc"])
                c["started_at"] = time.monotonic()
            except Exception as exc:      # the watchdog must never die
                log(f"watchdog error on {name}: {exc!r}")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)