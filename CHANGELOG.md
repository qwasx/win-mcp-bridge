# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-09-18

A code-review pass. Everything below was reproduced before being changed, and
the fixes were re-tested afterwards. Several of these were install-blocking:
**v1.0 could not actually be installed on a fresh PC.**

### Fixed — blocking

- **`install.cmd` referenced paths that do not exist in this repo.** It copied
  from `setup\payload\*` and looked for `wmc-patch\files`, neither of which was
  ever committed, so step 1 of 7 aborted on any clean clone. It now copies
  `src/` and `patches/` out of the repository itself.
- **The console-flash patch could silently not apply.** A failed patch printed
  `WARNING` and continued, so an install could "succeed" with the flash still
  present — the exact thing this project promises to prevent. It is now a hard
  error that aborts the install.
- **`machine.json` was written with a BOM.** PowerShell 5.1's `-Encoding utf8`
  emits a BOM; `json.load()` then failed, and the supervisor quietly generated
  a *new* identity, losing the hostname and tokens. Now written with
  `File.WriteAllText` + BOM-less `UTF8Encoding`, read back with `utf-8-sig`,
  and validated by a real JSON parse before the install continues. A corrupt
  identity file now refuses to start instead of silently replacing itself.
- **`BRIDGE_ALLOWED_HOSTS` was a placeholder nobody set.** It shipped as
  `YOUR-HOST.example.com` and the supervisor never injected the real value, so
  every request through the tunnel got `421 Misdirected Request`. The
  supervisor now derives it from `machine.json` and injects it, along with
  `BRIDGE_ALLOWED_ORIGINS`.
- **The examples called a tool that does not exist.** `fleet.py` and
  `verify_no_console_flash.py` used `RunScript`, which is not part of
  windows-mcp 0.8.5 (verified against the published sdist). They now use the
  real `PowerShell` tool; `cmd` and `python` snippets are wrapped, with Python
  sent base64-encoded so quotes and newlines survive.

### Fixed — no-flash promise

- `run_command` in the bridge now passes `CREATE_NO_WINDOW`, a hidden
  `STARTUPINFO`, and `stdin=DEVNULL`. Only the desktop channel was covered
  before, so the bridge channel still flashed a console.
- The scheduled task points straight at `pythonw.exe` instead of going through
  `cmd.exe /c`, which flashed a window at every logon.

### Fixed — security

- **Deny by default.** The auth middleware only guarded `/mcp*`; any other
  mounted path was open. Now everything except `/` and `/health` requires the
  token.
- **Constant-time token comparison** via `hmac.compare_digest`.
- **Removed `?token=` query-string auth** — it leaked the token into uvicorn's
  access log and Cloudflare's logs.
- **Tokens no longer appear in `argv`**; the desktop server receives its token
  through `WINDOWS_MCP_AUTH_KEY` in the environment. The startup banner prints
  a fingerprint, not the token.
- Dropped `/rl highest` from the scheduled task, which had been running the
  entire stack elevated at all times.
- `.bridge_token` added to `.gitignore`.
- Added `SECURITY.md`.

### Fixed — stability

- **The singleton lock is taken first.** Python discovery and identity loading
  ran at import time, before the lock on port 8021, so a second instance did
  10–30 s of work before discovering it had lost. Moved into `_init_runtime()`,
  called after the lock is held.
- **Log file handles are closed on respawn** instead of leaking one per restart.
- **Exponential backoff** (5 s → 300 s) replaces the tight restart loop, with a
  60 s startup grace period so a slow first boot is not killed as unhealthy.
- **Health checks actually check health** — `/health` is polled rather than
  inferring liveness from an open TCP port.
- **Log rotation** at 10 MB.
- **A missing `cloudflared` no longer crashes the supervisor**; the tunnel is
  an optional component.
- The mcp 1.x compatibility path was broken: on `TypeError` it retried without
  any keywords, silently dropping `transport_security` *and* `stateless_http`.
  Options are now applied to whichever of the constructor or
  `streamable_http_app()` accepts them, and `json_response=True` is set so
  large responses are not truncated as buffered SSE.
- `launch.cmd stop` only kills processes whose command line lives under its own
  install directory. It previously matched `cloudflared` anywhere and would
  kill unrelated processes.

### Changed — documentation

- The denylist is now described honestly as a typo guard, not a security
  boundary, with the bypasses spelled out.
- "24 desktop tools" corrected to ~20 (windows-mcp 0.8.5 registers 20
  `@mcp.tool` handlers).
- The "two supervisor processes" section no longer claims this is always
  harmless. It now tells you to check who holds the lock on port 8021, because
  a real second-instance race was observed in production logs.
- `git clone` URL no longer a `<you>` placeholder.
- `windows-mcp` is pinned to `==0.8.5`, since the patch is written against that
  exact file.
- The upstream MIT copyright header was added to the patched file.

## [1.0.0] - 2026-09-17

Initial public release: supervisor, bridge server, console-flash patch,
Cloudflare tunnel setup, fleet management examples, bilingual README.
