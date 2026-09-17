#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bridge_server.py - expose one folder plus command execution as a token-protected
Streamable HTTP MCP server.

Path:
    web agent -> HTTPS -> tunnel (cloudflared) -> this process -> local tools

Safety (on by default):
  1. every endpoint except / and /health needs a Bearer token in the
     Authorization header (deny by default; ?token= is deliberately not supported)
  2. file operations are confined to BRIDGE_ROOT; ../ escapes are rejected
  3. run_command has a denylist -- it catches typos, NOT a determined attacker.
     A regex denylist cannot win against shell=True (base64 -enc, ^ escaping,
     `cd ..`, reading files outside cwd all get through). Treat token
     possession as full control of the machine. For real containment use
     BRIDGE_READONLY and put Cloudflare Access in front.
  4. optional read-only mode (BRIDGE_READONLY=true) disables writes and commands

Works with both mcp 1.x (FastMCP) and mcp 2.x (MCPServer).

Environment:
  BRIDGE_TOKEN       access token (generated into .bridge_token if unset)
  BRIDGE_ROOT        root folder for file operations (default ~/bridge-workspace)
  BRIDGE_READONLY    true/false, default false
  BRIDGE_HOST        bind address, default 127.0.0.1 (keep it local; the tunnel
                     is the only intended way in - do not bind 0.0.0.0)
  BRIDGE_PORT        listen port, default 8000
  BRIDGE_MAX_OUTPUT  truncate command output at N chars, default 20000
  BRIDGE_EXTRA_BLOCK extra denylist regexes, separated by |
"""

import fnmatch
import functools
import hmac
import os
import re
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# ------------------------------------------------------------- config ---

SCRIPT_DIR = Path(__file__).resolve().parent
TOKEN_FILE = SCRIPT_DIR / ".bridge_token"


def load_token() -> str:
    """Priority: env var > .bridge_token file > generate and persist."""
    token = os.environ.get("BRIDGE_TOKEN", "").strip()
    if token:
        return token
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token
    import secrets

    token = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    print("[*] Generated an access token and saved it to .bridge_token - keep it secret")
    return token


TOKEN = load_token()
ROOT = Path(os.environ.get("BRIDGE_ROOT", str(Path.home() / "bridge-workspace"))).resolve()
READONLY = os.environ.get("BRIDGE_READONLY", "false").lower() in ("1", "true", "yes")
HOST = os.environ.get("BRIDGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("BRIDGE_PORT", "8000"))
MAX_OUTPUT = int(os.environ.get("BRIDGE_MAX_OUTPUT", "20000"))
ROOT.mkdir(parents=True, exist_ok=True)

# Denylist of destructive commands (Windows + Unix).
# Best-effort guard against fat-fingering, NOT a security boundary -- see the
# module docstring. Do not build features that assume this holds.
BLOCK_PATTERNS = [
    r"rm\s+-[a-z]*r[a-z]*f\w*\s+/",      # rm -rf /
    r"\bsudo\b",                         # privilege escalation
    r"\bmkfs\b",                         # filesystem format
    r"dd\s+.*of=/dev/",                  # dd to a raw device
    r":\(\)\s*\{",                       # fork bomb
    r"\bshutdown\b", r"\breboot\b", r"\bhalt\b", r"\bpoweroff\b",
    r"format\s+[a-zA-Z]:",               # Windows: format a drive
    r"\brd\s+/s",                        # Windows: recursive rmdir
    r"\bdel\s+/[sf]",                    # Windows: force delete
    r"\bdiskpart\b",
    r"chmod\s+(-R\s+)?777\s+/",          # chmod 777 on root
]
_extra = os.environ.get("BRIDGE_EXTRA_BLOCK", "").strip()
if _extra:
    BLOCK_PATTERNS.append(_extra)
BLOCK_RE = re.compile("|".join(f"(?:{p})" for p in BLOCK_PATTERNS), re.IGNORECASE)


# Same console-flash fix as the desktop channel: bridge_server itself runs under
# pythonw.exe (no console), so every shell command would otherwise get Windows to
# allocate a fresh VISIBLE console. The original patch only covered windows-mcp.
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0


def _hidden_startupinfo():
    if os.name != "nt":
        return None
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = 0      # SW_HIDE
    return si


def blocked_reason(command: str) -> str | None:
    m = BLOCK_RE.search(command)
    return f"blocked by denylist rule: {m.group(0)!r}" if m else None


def safe_path(user_path: str) -> Path:
    """Resolve a user path inside ROOT, raising if it escapes. Accepts relative
    and absolute paths."""
    p = Path(user_path.strip() or ".")
    target = (ROOT / p).resolve() if not p.is_absolute() else p.resolve()
    if target != ROOT and ROOT not in target.parents:
        raise ValueError(f"path escapes the sandbox (only {ROOT} is allowed): {user_path}")
    return target


def truncate(text: str, limit: int = MAX_OUTPUT) -> str:
    if len(text) > limit:
        return text[:limit] + f"\n\n[...truncated, {len(text)} chars total...]"
    return text


def _guard_path_errors(fn):
    """Turn safe_path's ValueError into a readable message the agent can act on."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ValueError as e:
            return f"error: {e}"
    return wrapper


# ----------------------------------------------------- the MCP server ---

try:
    # mcp 1.x
    from mcp.server.fastmcp import FastMCP as _ServerClass
except ImportError:  # mcp 2.x renamed FastMCP to MCPServer
    from mcp.server.mcpserver import MCPServer as _ServerClass

# ------------------- public Host allowlist (fixes 421 Invalid Host) ---------
# The mcp SDK's streamable_http_app() enables DNS-rebinding protection when the
# host is a loopback address, and allowed_hosts defaults to
# ["127.0.0.1:*","localhost:*","[::1]:*"]. Requests arriving through the tunnel
# carry the public hostname, so the bridge rejects them itself with 421.
# Fix: pass an explicit allowlist. Protection stays ON (unknown hosts are still
# rejected); we only whitelist names we own, which is safer than disabling it.
# Override with BRIDGE_ALLOWED_HOSTS / BRIDGE_ALLOWED_ORIGINS (comma-separated).
# NOTE: the defaults below are LOCAL ONLY on purpose. Your public hostname is
# injected at runtime by supervisor.py via BRIDGE_ALLOWED_HOSTS (read from
# machine.json). Hard-coding a placeholder here used to mean that if that
# injection ever failed, the failure was invisible until every tunnelled
# request came back 421.
_DEFAULT_ALLOWED_HOSTS = [
    "127.0.0.1", "127.0.0.1:*",
    "localhost", "localhost:*",
    "[::1]", "[::1]:*",
]
_DEFAULT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*",
]


def _env_list(name: str) -> list[str]:
    return [x.strip() for x in os.environ.get(name, "").split(",") if x.strip()]


ALLOWED_HOSTS = _env_list("BRIDGE_ALLOWED_HOSTS") or _DEFAULT_ALLOWED_HOSTS
ALLOWED_ORIGINS = _env_list("BRIDGE_ALLOWED_ORIGINS") or _DEFAULT_ALLOWED_ORIGINS
# Loud about it: running with only the local defaults is fine on a dev box, but
# through a tunnel it means every request comes back 421 with no clue why.
_HOSTS_FROM_ENV = bool(_env_list("BRIDGE_ALLOWED_HOSTS"))

try:
    from mcp.server.transport_security import (
        TransportSecuritySettings as _TransportSecuritySettings,
    )
except ImportError:  # very old versions lack this module
    _TransportSecuritySettings = None

# json_response=True matters here too: read_file can return up to 2MB and
# search_files can be large, and Cloudflare truncates buffered SSE.
_ts_kwargs: dict = {}
if _TransportSecuritySettings is not None:
    _ts_kwargs["transport_security"] = _TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=ALLOWED_HOSTS,
        allowed_origins=ALLOWED_ORIGINS,
    )


# Build the server. mcp 1.x wants these on the constructor, 2.x on
# streamable_http_app(); try the constructor first and fall back.
_srv_kwargs = dict(stateless_http=True, json_response=True, **_ts_kwargs)
try:
    server = _ServerClass(name="local-bridge", **_srv_kwargs)
    _CTOR_TOOK_OPTS = True
except TypeError:
    server = _ServerClass(name="local-bridge")
    _CTOR_TOOK_OPTS = False



@server.tool()
@_guard_path_errors
def get_status() -> str:
    """Show bridge status: platform, workspace, read-only flag, available tools."""
    import platform

    return (
        f"local-bridge is running\n"
        f"system: {platform.system()} {platform.release()} ({platform.machine()})\n"
        f"workspace: {ROOT}\n"
        f"read-only: {'on (writes and commands disabled)' if READONLY else 'off'}\n"
        f"tools: get_status / read_file / list_directory / search_files / "
        f"write_file / edit_file / run_command"
    )


@server.tool()
@_guard_path_errors
def read_file(path: str, start_line: int = 1, max_lines: int = 500) -> str:
    """Read a text file inside the workspace, paginated. Paths may be relative or
    absolute but must stay inside the workspace."""
    target = safe_path(path)
    if not target.is_file():
        return f"error: no such file: {path}"
    if target.stat().st_size > 2 * 1024 * 1024:
        return f"error: file exceeds 2MB, use search_files to locate first: {path}"
    lines = target.read_text(encoding="utf-8", errors="ignore").splitlines()
    start = max(start_line - 1, 0)
    picked = lines[start:start + max_lines]
    total = len(lines)
    head = (f"file: {target} ({total} lines, showing {start + 1}-{start + len(picked)})\n"
            + "-" * 40)
    return head + "\n" + "\n".join(picked)


@server.tool()
@_guard_path_errors
def list_directory(path: str = ".", depth: int = 1, max_entries: int = 200) -> str:
    """List directory contents; recursive up to `depth` (default 1)."""
    target = safe_path(path)
    if not target.is_dir():
        return f"error: no such directory: {path}"
    out: list[str] = []
    base = str(target)

    def walk(d: Path, level: int):
        if level > depth or len(out) >= max_entries:
            return
        try:
            entries = sorted(d.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        except PermissionError:
            out.append(f"{'  ' * level}[permission denied] {d}")
            return
        for e in entries:
            if len(out) >= max_entries:
                out.append("...(too many entries, truncated)")
                return
            rel = e.relative_to(target)
            mark = "/" if e.is_dir() else f" ({e.stat().st_size} bytes)"
            out.append(f"{'  ' * level}{rel}{mark}")
            if e.is_dir() and level < depth:
                walk(e, level + 1)

    out.append(f"directory: {base}")
    walk(target, 1)
    return "\n".join(out)


@server.tool()
@_guard_path_errors
def search_files(pattern: str, path: str = ".", file_glob: str = "*",
                 max_results: int = 50, case_sensitive: bool = False) -> str:
    """Regex content search inside the workspace, returning file:line:text.
    Pure Python, so it works on Windows without grep."""
    target = safe_path(path)
    if not target.exists():
        return f"error: no such path: {path}"
    flags = 0 if case_sensitive else re.IGNORECASE
    try:
        rx = re.compile(pattern, flags)
    except re.error as e:
        return f"error: invalid regex: {e}"
    if target.is_file():
        files = [target]
    else:
        files = [p for p in target.rglob("*") if p.is_file()]
    hits: list[str] = []
    scanned = 0
    for f in files:
        if len(hits) >= max_results:
            break
        if not fnmatch.fnmatch(f.name, file_glob):
            continue
        try:
            if f.stat().st_size > 2 * 1024 * 1024:
                continue
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        scanned += 1
        for i, line in enumerate(text.splitlines(), 1):
            if rx.search(line):
                try:
                    rel = f.relative_to(ROOT)
                except ValueError:
                    rel = f
                hits.append(f"{rel}:{i}: {line.strip()[:300]}")
                if len(hits) >= max_results:
                    break
    head = (f"search {pattern!r} in {target} "
            f"({scanned} files scanned, {len(hits)} matches):")
    return head + "\n" + ("\n".join(hits) if hits else "(no matches)")


@server.tool()
@_guard_path_errors
def write_file(path: str, content: str, mode: str = "rewrite") -> str:
    """Write a file. mode=rewrite overwrites, mode=append appends.
    Disabled in read-only mode."""
    if READONLY:
        return "error: read-only mode, writing is disabled."
    target = safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if mode == "append":
        with open(target, "a", encoding="utf-8") as f:
            f.write(content)
        return f"appended {len(content)} chars to: {target}"
    elif mode == "rewrite":
        target.write_text(content, encoding="utf-8")
        return f"wrote {len(content)} chars to: {target}"
    return f"error: unknown mode={mode!r}; use rewrite or append."


@server.tool()
@_guard_path_errors
def edit_file(path: str, old_text: str, new_text: str) -> str:
    """Replace the first exact occurrence of old_text. Disabled in read-only mode."""
    if READONLY:
        return "error: read-only mode, editing is disabled."
    target = safe_path(path)
    if not target.is_file():
        return f"error: no such file: {path}"
    text = target.read_text(encoding="utf-8", errors="ignore")
    if old_text not in text:
        return "error: old_text not found (must match exactly, including whitespace)."
    target.write_text(text.replace(old_text, new_text, 1), encoding="utf-8")
    return f"replaced in: {target}"


@server.tool()
@_guard_path_errors
def run_command(command: str, timeout_seconds: int = 30, workdir: str = ".") -> str:
    """Run a shell command inside the workspace and return its output.
    Disabled in read-only mode; destructive commands are blocked."""
    if READONLY:
        return "error: read-only mode, command execution is disabled."
    reason = blocked_reason(command)
    if reason:
        return f"error: {reason}"
    cwd = safe_path(workdir)
    if not cwd.is_dir():
        return f"error: no such working directory: {workdir}"
    timeout_seconds = max(1, min(timeout_seconds, 300))
    try:
        proc = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout_seconds, cwd=str(cwd),
            stdin=subprocess.DEVNULL,
            creationflags=_NO_WINDOW, startupinfo=_hidden_startupinfo(),
        )
    except subprocess.TimeoutExpired:
        return f"error: command timed out (>{timeout_seconds}s) and was killed: {command}"
    out = (proc.stdout or "") + (f"\n[stderr]\n{proc.stderr}" if proc.stderr else "")
    return f"$ {command}\nexit code: {proc.returncode}\n" + "-" * 40 + "\n" + (truncate(out.strip()) or "(no output)")


# ------------------------------------------------- auth and routing ---

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route


class BearerAuthMiddleware:
    """Bearer auth middleware. DENY BY DEFAULT.

    Only "/" and "/health" are public; everything else needs the token. The
    earlier version guarded just "/mcp*", which would silently expose any future
    endpoint mounted elsewhere.

    Accepted: header  Authorization: Bearer <TOKEN>
    """

    PUBLIC = ("/", "/health")

    def __init__(self, app, token: str):
        self.app = app
        self.expected = f"Bearer {token}"

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path", "") not in self.PUBLIC:
            headers = {k.decode("latin-1").lower(): v.decode("latin-1")
                       for k, v in scope.get("headers", [])}
            # compare_digest: constant time, so the token can't be recovered by
            # timing the comparison byte by byte.
            ok = hmac.compare_digest(headers.get("authorization", ""), self.expected)
            # NOTE: ?token= was removed on purpose -- query strings land in
            # uvicorn's access log and in Cloudflare's logs.
            if not ok:
                resp = JSONResponse({"error": "unauthorized: missing or invalid token"},
                                    status_code=401)
                await resp(scope, receive, send)
                return
        await self.app(scope, receive, send)


async def index(_request):
    return JSONResponse({
        "name": "local-bridge",
        "mcp_endpoint": "/mcp (requires a Bearer token)",
        "health": "/health",
        "readonly": READONLY,
    })


async def health(_request):
    return JSONResponse({"status": "ok", "mcp_path": "/mcp",
                         "auth": "required", "readonly": READONLY})


if _CTOR_TOOK_OPTS:
    # Options already applied at construction (mcp 1.x style).
    _mcp_app = server.streamable_http_app()
else:
    # mcp 2.x: pass them here instead. Dropping them silently -- which the
    # original code did on TypeError -- lost transport_security AND
    # stateless_http, so tunnelled requests kept getting 421.
    _mcp_app = server.streamable_http_app(**_srv_kwargs)

_mcp_app.add_middleware(BearerAuthMiddleware, token=TOKEN)


@asynccontextmanager
async def _lifespan(_app):
    # A Mounted sub-app's lifespan is not run automatically; forward it here,
    # otherwise the MCP session manager's task group is never initialised.
    async with _mcp_app.router.lifespan_context(_mcp_app):
        yield


app = Starlette(routes=[
    Route("/", index),
    Route("/health", health),
    Mount("/", app=_mcp_app),
], lifespan=_lifespan)


# ------------------------------------------------------- entry point ---

def main():
    print("=" * 62)
    print("  local-bridge started")
    print("=" * 62)
    print(f"  local URL  : http://{HOST}:{PORT}/mcp")
    print(f"  health     : http://{HOST}:{PORT}/health")
    print(f"  workspace  : {ROOT}")
    print(f"  read-only  : {'on' if READONLY else 'off'}")
    print(f"  allowed    : {', '.join(ALLOWED_HOSTS)}")
    print(f"  token      : {TOKEN[:4]}...{TOKEN[-4:]} "
          f"({len(TOKEN)} chars; full value in .bridge_token)")
    print("-" * 62)
    print("  Expose it with a tunnel (run in another terminal):")
    print(f"    cloudflared tunnel --url http://{HOST}:{PORT}")
    print("  Then point your MCP client at https://<your-host>/mcp")
    print("  and use the token above for Bearer auth.")
    print("=" * 62)
    print("  WARNING: this token is a key to your PC. Never share it.")
    if not _HOSTS_FROM_ENV:
        print("  NOTE: BRIDGE_ALLOWED_HOSTS not set - localhost only. Requests")
        print("        arriving via a tunnel hostname will be refused with 421.")
    print("=" * 62)
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped.")
        sys.exit(0)
