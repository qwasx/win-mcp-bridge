# Troubleshooting

## Both endpoints return HTTP 530

The tunnel is not connected — `cloudflared` is down or never started.

```cmd
launch.cmd status
type C:\mcp-bridge\tunnel.log
```

If `supervisor : 0 proc`, start it directly to see errors:

```cmd
C:\mcp-bridge\python\python.exe C:\mcp-bridge\supervisor.py
```

## HTTP 401

Token mismatch. The client token must equal the one in `machine.json`
(`desktop_token` for `/desktop/mcp`, `bridge_token` for `/mcp`).

## HTTP 404 on /desktop/mcp

cloudflared forwards paths unchanged, so the backend must be mounted there:

```
FASTMCP_STREAMABLE_HTTP_PATH=/desktop/mcp
```

## HTTP 421 Misdirected Request

The desktop server's TrustedHostMiddleware rejected the public Host header.
Start it with `--allow-insecure-remote` (safe when bound to 127.0.0.1, since only
the tunnel can reach it).

## Truncated screenshots / large responses

Cloudflare buffers SSE. Force plain JSON:

```
FASTMCP_JSON_RESPONSE=1
```

## Black console windows flashing

The patch in `patches/` was not applied, or a `windows-mcp` upgrade overwrote it.

```powershell
$d = "<site-packages>\windows_mcp\powershell"
Copy-Item patches\windows_mcp_powershell_utils.py "$d\utils.py" -Force
# then restart so the change is picked up
```

Verify:

```powershell
(Get-Content "$d\utils.py" -Raw).Contains('CREATE_NO_WINDOW')   # must be True
```

## Two supervisor processes

Two entries in the process list can mean either of two things, and an earlier
version of this page wrongly said it was always harmless. Don't count
processes — **ask who holds the lock on 127.0.0.1:8021**. That is the only
answer that matters:

```powershell
$owner = (Get-NetTCPConnection -LocalPort 8021 -State Listen -EA SilentlyContinue).OwningProcess
$all   = @(Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'supervisor\.py' })
$all | Select ProcessId, ParentProcessId, @{n='holdsLock';e={$_.ProcessId -eq $owner}}
```

* **Exactly one row has `holdsLock = True`** → fine. `pythonw.exe` normally
  shows a parent/child pair (measured: launching one script really does create
  two PIDs), and only the child holds the lock.
* **No row holds the lock** → the stack is not actually up. `launch.cmd stop`
  then `launch.cmd`.
* **A second process lingers for more than ~30 s** → it lost the race and is
  on its way out. Confirm with:

  ```powershell
  Select-String 'already running' C:\mcp-bridge\logs\supervisor.log | Select -Last 5
  ```

  Seeing that line is normal (the loser exits by design); seeing it *repeatedly*
  with a fresh timestamp each logon means something is starting the task twice
  — check for a duplicate `MCP-Stack` entry in Task Scheduler.

## "TUNNEL BLOCKED" in supervisor.log

You copied an install folder from another machine. That identity belongs to a
different host. Run the installer to create this machine's own tunnel, or edit
`machine.json` (`bound_computer`, `hostname`, tokens) and create a tunnel
manually.

## Client can't connect: ModuleNotFoundError: httpx2

`mcp` 2.x uses `httpx2`, not `httpx`:

```
pip install httpx2 mcp
```

## Chinese / non-ASCII text comes back as mojibake

Specify the encoding explicitly:

```python
open(path, encoding="utf-8").read()
```

```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Get-Content $path -Encoding utf8
```
