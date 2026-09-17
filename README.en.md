<div align="center">

# win-mcp-bridge

**Give an AI agent full remote control of a Windows PC — with zero console windows flashing on screen.**

**English** · [简体中文](README.md)

![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4)
![python](https://img.shields.io/badge/python-3.11%2B-3776ab)

</div>

---

## What is this

A production-grade deployment layer for handing a Windows PC over to an AI agent.

The desktop automation itself is [Windows-MCP](https://github.com/CursorTouch/Windows-MCP).
This project solves everything around it: **keeping it running on a real machine —
quietly, reliably, and safely.**

Once installed, you can tell any MCP-capable AI to take a screenshot, click, type,
run commands, read and write files — and **nothing flashes on your screen.**

> Every line here runs on a real daily-driver Windows box, and every fix exists
> because something actually broke. Even if you never run this code, the
> **[Hard-won lessons](#hard-won-lessons)** section is worth reading.

---

## What you get

| | |
|---|---|
| **~20 desktop tools** | screenshot, click, type, UIA tree, PowerShell, registry, whole-disk access |
| **7 file/shell tools** | read/write files, run commands |
| **Zero visible windows** | no tray icon, no console, no flash — see [the flash fix](#1-the-console-flash) |
| **Self-healing** | a supervisor restarts any dead component within 15s |
| **Portable** | no hardcoded paths or usernames; runs from any folder |
| **Multi-machine** | one client-side list, many PCs, no identity collisions |
| **Offline installer** | bundles a private Python; target PC needs nothing pre-installed |

---

## Architecture

```
        Internet
           │
   Cloudflare Tunnel            one tunnel per machine (see note)
           │
   ┌───────┴────────┐
   │  cloudflared   │
   └───────┬────────┘
           │  ingress by path
    ┌──────┴───────┐
    │              │
/desktop/mcp     /mcp
    │              │
127.0.0.1:8010  127.0.0.1:8000
 windows-mcp     bridge_server.py
 (desktop)       (files + shell)
    │              │
    └──────┬───────┘
           │
    supervisor.py          watchdog: respawns dead children, holds a
                           single-instance lock on 127.0.0.1:8021
```

---

## Requirements

- Windows 10/11 **64-bit**
- A Cloudflare account + a domain on it (free tier is fine)
- **Nothing else.** The installer ships its own Python.

---

## Quick start

```cmd
git clone https://github.com/qwasx/win-mcp-bridge
cd win-mcp-bridge\setup
:: right-click install.cmd -> Run as administrator
install.cmd --id pc1
```

Admin rights are needed for exactly one thing: registering the logon task.
Skip it and start manually with `launch.cmd` instead.

Note: the task runs as the **logged-in user**. Earlier versions passed
`/rl highest`, which left the whole stack running elevated at all times; that
has been removed. Elevate individual commands instead when you need to.

The installer will:

1. unpack a private Python (embeddable, ~11 MB — no registry, no PATH changes)
2. install `windows-mcp` and the bridge deps (offline if `offline/wheels` exists)
3. re-apply the patches in `patches/`
4. run `cloudflared tunnel login` → **you click Authorize once in the browser**
5. create *this machine's own* tunnel + DNS record
6. generate `machine.json` with fresh random tokens
7. register the startup task and launch

At the end it prints a JSON block to paste into your client-side machine list.

### Day-to-day

```cmd
launch.cmd            :: start (idempotent)
launch.cmd status     :: is it up?
launch.cmd stop
launch.cmd restart
```

---

## Connecting from a client

```python
import httpx2                      # NOTE: httpx2, not httpx — mcp 2.x uses httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

URL   = "https://pc1.example.com/desktop/mcp"
TOKEN = "<desktop_token from machine.json>"

http_client = httpx2.AsyncClient(
    headers={"Authorization": f"Bearer {TOKEN}"},
    timeout=httpx2.Timeout(connect=30, read=180, write=60, pool=30),
    transport=httpx2.AsyncHTTPTransport(retries=5),
)
async with http_client as hc:
    async with streamable_http_client(URL, http_client=hc) as (r, w, *_):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
```

A `read` timeout of **180 s** matters: screenshots can be several hundred KB.

See [`examples/fleet.py`](examples/fleet.py) for the multi-machine wrapper.

---

## Multi-machine

**Each PC must get its own tunnel.** This is not a style choice — Cloudflare
treats two `cloudflared` processes sharing a tunnel UUID as *replicas* and routes
each request to a **random** one of them
([docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/deploy-replicas/)).
For a remote-control tool that is actively dangerous: your screenshot comes from
machine A and the click that follows lands on machine B.

So identity is split out of the code:

```
repo / installer payload          machine.json  (per PC, gitignored)
─────────────────────────         ──────────────────────────────────
supervisor.py                     machine_id, label
bridge_server.py                  hostname          ← its own subdomain
launch.cmd                        bridge_token      ← its own secrets
patches/                          desktop_token
                                  bound_computer    ← anti-cross-wiring guard
```

`bound_computer` is a safety net: if you clone a whole install folder to another
box, the supervisor sees the hostname mismatch and **refuses to start the
tunnel**, logging how to fix it. Local ports still work.

Client side, all of that disappears behind one list:

```python
await fleet_status()                  # every machine, one table
await run_on("office", "ps", "...")   # target one
await run_on_all("ps", "...")         # broadcast
```

---

## Hard-won lessons

The interesting part. Each of these cost real debugging time.

### 1. The console flash

**Symptom.** Every PowerShell tool call flashed a black console window. Fast
enough that screenshots never caught it.

**Cause.** In `windows_mcp/powershell/utils.py`, the single function every
PowerShell call funnels through:

```python
creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP   # only this
```

`CREATE_NEW_PROCESS_GROUP` is needed to send `CTRL_BREAK_EVENT` for graceful
shutdown — but it does **not** stop Windows from allocating a console.

**Fix** (in [`patches/`](patches/)):

```python
creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP
creationflags |= getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

if kwargs.get("startupinfo") is None:          # belt and braces
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = 0                          # SW_HIDE
    kwargs["startupinfo"] = si
```

`CREATE_NO_WINDOW` and `CREATE_NEW_PROCESS_GROUP` **can coexist** — only
`DETACHED_PROCESS` conflicts. Graceful shutdown still works.

**How to actually verify this.** Eyeballing proves nothing; the flash is ~50 ms.
Poll for console windows while hammering the API:

```
EnumWindows every 50 ms for 12 s, matching ConsoleWindowClass
             + CASCADIA_HOSTING_WINDOW_CLASS
concurrently: 12 commands (PowerShell / cmd / ps)
→ NO_CONSOLE_WINDOW_EVER_APPEARED
```

**Caveat:** reinstalling/upgrading `windows-mcp` overwrites this. Re-apply.

### 2. The embeddable Python has no `venv`

```
C:\python\python.exe: No module named venv
```

Python's embeddable distribution ships without `venv`. Any installer that does
`python -m venv` will fail on a fresh machine. Install packages directly into the
embeddable interpreter instead — verified working end to end (server starts,
answers MCP, patches apply).

### 3. `#import site` in `python3xx._pth`

The embeddable build ships with site imports **commented out**. Leave it and
`pip`-installed packages are silently unimportable. The installer rewrites:

```
#import site   →   import site
```

### 4. Never let a launcher trigger its own scheduled task

This one took the whole bridge offline.

The scheduled task ran `launch.cmd`; `launch.cmd`'s start path called
`schtasks /run /tn "MCP-Stack"`. Task → script → task, forever. The supervisor
never started and both endpoints went to HTTP 530.

**The deeper mistake was the verification method.** Three checks in a row
reported "UP" — because the *old* supervisor process was still alive and masking
the broken path. Port-is-open is not proof.

> **Rule: after changing a startup chain, kill everything and cold-boot through
> the real path.** Anything less tests the old process.

### 5. Single-instance locking: bind a port, not a PID file

Duplicate supervisors are easy to spawn and hard to notice. A PID file goes stale
when a process is killed. A bound socket is released by the kernel automatically:

```python
SINGLETON_PORT = 8021
s.bind(("127.0.0.1", SINGLETON_PORT))   # second instance fails → exits
```

### 6. `pythonw.exe` shows up twice in process lists

A `pythonw.exe` script appears as a **parent/child pair with identical command
lines**. Two rows is normal. Count only processes whose parent is *not* in the
set:

```powershell
$all = @(Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'supervisor\.py' })
$ids = $all.ProcessId
@($all | ? { $ids -notcontains $_.ParentProcessId }).Count   # → 1
```

Or just check listener counts on 8000/8010.

### 7. Verify an interpreter by importing, not by `os.path.exists`

A path existing says nothing about whether its dependencies are installed:

```python
subprocess.run([exe, "-c", "import mcp,uvicorn,starlette"], timeout=25,
               creationflags=CREATE_NO_WINDOW).returncode == 0
```

### 8. Cloudflare buffers SSE

Large streamed responses (screenshots, 200 KB–900 KB) were intermittently
truncated — HTTP 200, incomplete body. Forcing plain JSON fixed it:

```
FASTMCP_JSON_RESPONSE=1
```

### 9. cloudflared does not strip path prefixes

An ingress rule matching `^/desktop` forwards the path **unchanged**. The backend
must mount itself at `/desktop/mcp`:

```
FASTMCP_STREAMABLE_HTTP_PATH=/desktop/mcp
```

Otherwise you get 404s that look like tunnel problems.

### 10. Portable PowerShell is a 3× speedup

`windows-mcp` prefers `pwsh` when present:

```python
shell = shell or ("pwsh" if shutil.which("pwsh") else "powershell")
```

Windows PowerShell 5.1 cold-start was 5–6 s per call. Dropping a portable `pwsh`
into the install dir and prepending it to the child `PATH` brought that to 1–2 s.

---

## Security

This exposes **full Administrator-level control of a PC** to anyone holding a
token. Be deliberate:

- `machine.json`, `tunnel.json`, `config.yml`, `cert.pem`, `.bridge_token` are
  **gitignored** — keep it that way
- tokens are generated per machine, so a leak is contained to one box
- to rotate: edit `machine.json`, `launch.cmd restart`, old tokens die instantly
- consider Cloudflare Access in front of the hostname for a second factor

**Being straight about the `run_command` denylist:**

It catches typos. It is **not** a security boundary. A regex denylist cannot
beat `shell=True` — `-enc <base64>`, `sh^utdown`, `cd ..` then operate, or just
calling the same API a different way all walk right through it. **Assume
token == full control of the machine.** For real containment use
`BRIDGE_READONLY=1` and put Cloudflare Access in front; don't lean on the
denylist.

Auth (tightened in v1.1):
- only `/` and `/health` are public; everything else requires the Bearer token
  (deny by default)
- comparison uses `hmac.compare_digest` (constant time)
- **`?token=` query-string auth was removed** — query strings end up in
  uvicorn's access log and in Cloudflare's logs
- the startup banner prints a fingerprint (`abcd...wxyz`), never the full token

---

## Layout

```
src/
  supervisor.py       watchdog, identity loading, single-instance lock
  bridge_server.py    file + shell MCP server (port 8000)
  launch.cmd          start / stop / status / restart
patches/
  windows_mcp_powershell_utils.py   drop-in: kills the console flash
setup/
  install.cmd                 new-machine installer
  config.yml.example
  machine.json.example
examples/
  fleet.py            multi-machine client wrapper
docs/
  TROUBLESHOOTING.md
```

---

## Credits & license

Desktop automation is [Windows-MCP](https://github.com/CursorTouch/Windows-MCP)
by CursorTouch (MIT). This repo is the deployment/hardening layer around it.

MIT — see [LICENSE](LICENSE).
