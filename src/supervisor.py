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


PYTHON, _PY_HOW = _find_python()
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
        try:
            with open(MACHINE_FILE, "r", encoding="utf-8") as f:
                data.update(json.load(f) or {})
        except Exception as exc:
            log(f"machine.json unreadable ({exc!r}), regenerating")
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


IDENTITY = load_identity()
MACHINE_ID = IDENTITY["machine_id"]
BRIDGE_TOKEN = IDENTITY["bridge_token"]

# ---- Process 2: Windows-MCP, the desktop automation backend ----
#  https://github.com/CursorTouch/Windows-MCP  (MIT, pip package: windows-mcp)
DESKTOP_EXE = os.path.join(BASE, "venv-desktop", "Scripts", "windows-mcp.exe")
_DESK_PYW = os.path.join(BASE, "venv-desktop", "Scripts", "pythonw.exe")
DESKTOP_LOG = os.path.join(BASE, "desktop.log")
DESKTOP_PORT = 8010
DESKTOP_TOKEN = IDENTITY["desktop_token"]
# Mount the MCP endpoint at /desktop/mcp. cloudflared does NOT strip path
# prefixes, so the backend must mount itself there for the public URL to match.
DESKTOP_MCP_PATH = "/desktop/mcp"

# ---- Process 3: the Cloudflare tunnel ----
CLOUDFLARED = os.path.join(BASE, "cloudflared.exe")
CONFIG = os.path.join(BASE, "config.yml")
TUNNEL_LOG = os.path.join(BASE, "tunnel.log")

CHECK_INTERVAL = 15

ENV = dict(os.environ)
ENV["BRIDGE_TOKEN"] = BRIDGE_TOKEN
ENV["BRIDGE_ROOT"] = BRIDGE_ROOT
ENV["PYTHONIOENCODING"] = "utf-8"
ENV["PYTHONUTF8"] = "1"
ENV["ANONYMIZED_TELEMETRY"] = "false"   # disable windows-mcp PostHog telemetry
ENV["FASTMCP_STREAMABLE_HTTP_PATH"] = DESKTOP_MCP_PATH

# Force plain application/json instead of text/event-stream.
# Cloudflare buffers SSE; large responses (screenshots, 200KB-900KB) were
# intermittently truncated (HTTP 200, incomplete body).
ENV["FASTMCP_JSON_RESPONSE"] = "1"

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


def port_open(port: int, host: str = "127.0.0.1") -> bool:
    s = socket.socket()
    s.settimeout(2)
    try:
        return s.connect_ex((host, port)) == 0
    finally:
        s.close()


def spawn(cmd, logfile, tag):
    lf = open(logfile, "a", encoding="utf-8", errors="replace")
    proc = subprocess.Popen(
        cmd, cwd=BASE, env=ENV, stdin=subprocess.DEVNULL,
        stdout=lf, stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW | NEW_GROUP, close_fds=True,
    )
    log(f"{tag} started pid={proc.pid}")
    return proc


def start_bridge():
    return spawn([PYTHON, BRIDGE_PY], BRIDGE_LOG, "bridge")


def _desktop_head():
    r"""Decide how to launch windows_mcp. Two layouts are supported:
      A) BASE\venv-desktop\  -- a virtualenv (upgrade path / existing installs)
      B) BASE\python\        -- windows-mcp installed straight into the
         interpreter, because the Python EMBEDDABLE BUILD HAS NO venv MODULE
         ("No module named venv"), so the installer cannot create one.
    pythonw.exe is preferred: GUI subsystem, no console window."""
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
            return [exe]
        try:
            r = subprocess.run([exe, "-c", "import windows_mcp"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               stdin=subprocess.DEVNULL, timeout=25,
                               creationflags=CREATE_NO_WINDOW)
            if r.returncode == 0:
                return [exe, "-m", "windows_mcp"]
        except Exception:
            continue
    log("WARNING: no interpreter with windows_mcp found; falling back")
    return [DESKTOP_EXE]


def start_desktop():
    head = _desktop_head()
    return spawn(
        head + ["serve",
         "--transport", "streamable-http",
         "--host", "127.0.0.1",
         "--port", str(DESKTOP_PORT),
         "--auth-key", DESKTOP_TOKEN,
         # Bound to 127.0.0.1 (only the tunnel reaches it); this flag only skips the
         # Host check, otherwise TrustedHostMiddleware returns 421 for the public Host.
         "--allow-insecure-remote",
         # Stateless: clients survive a backend restart without re-handshaking.
         "--stateless-http"],
        DESKTOP_LOG, "desktop",
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


def start_tunnel():
    if not tunnel_allowed():
        return None
    ensure_config()
    return spawn([CLOUDFLARED, "tunnel", "--config", CONFIG, "run"], TUNNEL_LOG, "tunnel")




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


def main() -> int:
    if not acquire_singleton():
        log("another supervisor is already running, exiting")
        return 0
    log("supervisor boot")
    log(f"machine={MACHINE_ID} label={IDENTITY.get('label')} "
        f"host={IDENTITY.get('hostname') or '(unset)'}")
    log(f"python={PYTHON} ({_PY_HOW})")
    log("desktop=" + " ".join(_desktop_head()))
    bridge = start_bridge()
    time.sleep(10)
    desktop = start_desktop()
    time.sleep(14)
    tunnel = start_tunnel()

    while True:
        time.sleep(CHECK_INTERVAL)
        try:
            if bridge.poll() is not None:
                log(f"bridge exited code={bridge.returncode}, restarting")
                bridge = start_bridge()
                time.sleep(10)
            elif not port_open(BRIDGE_PORT):
                log(f"port {BRIDGE_PORT} not listening, restarting bridge")
                try:
                    bridge.kill()
                except OSError:
                    pass
                bridge = start_bridge()
                time.sleep(10)

            if desktop.poll() is not None:
                log(f"desktop exited code={desktop.returncode}, restarting")
                desktop = start_desktop()
                time.sleep(10)
            elif not port_open(DESKTOP_PORT):
                log(f"port {DESKTOP_PORT} not listening, restarting desktop")
                try:
                    desktop.kill()
                except OSError:
                    pass
                desktop = start_desktop()
                time.sleep(10)

            if tunnel is not None and tunnel.poll() is not None:
                log(f"tunnel exited code={tunnel.returncode}, restarting")
                tunnel = start_tunnel()
                time.sleep(5)
        except Exception as exc:  # the watchdog must never die
            log(f"watchdog error: {exc!r}")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)