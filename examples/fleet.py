"""
fleet.py - one client-side entry point for many machines.

Design:
  * The machine list lives in machines.json. Adding a PC = adding a record;
    no code changes.
  * Each machine has its own hostname + tokens, because underneath each one has
    its OWN Cloudflare tunnel. That is mandatory: two hosts sharing a tunnel ID
    are treated as replicas and Cloudflare picks one at RANDOM, so you would not
    know which machine you are driving.
  * The API above that is uniform: pc("office") for one, all_machines() for all.

Usage:
    from fleet import pc, fleet_status, run_on, run_on_all

    async with pc("pc1").session("B") as s:      # target one machine
        await s.call_tool(...)

    await fleet_status()                          # liveness of every machine
    await run_on("pc1", "ps", "hostname")         # run on one
    await run_on_all("ps", "hostname")            # run on all
"""

import asyncio
import json
import os
import re
from contextlib import asynccontextmanager

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

HERE = os.path.dirname(os.path.abspath(__file__))
MACHINES_FILE = os.path.join(HERE, "machines.json")


def _load():
    with open(MACHINES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {m["id"]: m for m in data["machines"]}


MACHINES = _load()
DEFAULT = next(iter(MACHINES))


class Machine:
    """A managed machine."""

    def __init__(self, cfg):
        self.id = cfg["id"]
        self.label = cfg.get("label", cfg["id"])
        self.host = cfg["hostname"].rstrip("/")
        self.enabled = cfg.get("enabled", True)
        self._tokens = {"A": cfg["bridge_token"], "B": cfg["desktop_token"]}
        self._paths = {"A": "/mcp", "B": "/desktop/mcp"}

    def url(self, line="B"):
        base = self.host
        if not base.startswith("http"):
            base = "https://" + base
        return base + self._paths[line]

    def _client(self, line):
        return httpx2.AsyncClient(
            headers={"Authorization": f"Bearer {self._tokens[line]}"},
            timeout=httpx2.Timeout(connect=30.0, read=180.0, write=60.0, pool=30.0),
            transport=httpx2.AsyncHTTPTransport(retries=5),
        )

    @asynccontextmanager
    async def session(self, line="B"):
        """Open a long-lived session to this machine."""
        async with self._client(line) as hc:
            async with streamable_http_client(self.url(line), http_client=hc) as (r, w, *_):
                async with ClientSession(r, w) as s:
                    await s.initialize()
                    yield s

    async def ping(self, line="B", timeout=20):
        """Return (online?, tool count or error name)."""
        try:
            async with asyncio.timeout(timeout):
                async with self.session(line) as s:
                    tl = await s.list_tools()
                    return True, len(tl.tools)
        except Exception as exc:
            return False, type(exc).__name__

    def __repr__(self):
        return f"<Machine {self.id} {self.label} {self.host}>"


def pc(machine_id=None):
    """Get a machine by id; the first one if omitted."""
    mid = machine_id or DEFAULT
    if mid not in MACHINES:
        raise KeyError(f"unknown machine '{mid}'; available: {', '.join(MACHINES)}")
    return Machine(MACHINES[mid])


def all_machines(include_disabled=False):
    return [Machine(c) for c in MACHINES.values()
            if include_disabled or c.get("enabled", True)]


def clean(text):
    text = re.sub(r"^Response:\s*", "", text)
    text = re.sub(r"\s*Status Code: \d+\s*$", "", text)
    return re.split(r"\n\[stderr\]", text)[0].strip()


def render(result):
    out = []
    for c in getattr(result, "content", []) or []:
        t = getattr(c, "text", None)
        if t is not None:
            out.append(t)
        else:
            d = getattr(c, "data", None)
            if d is not None:
                out.append(f"<{getattr(c,'mimeType','binary')} {len(d)} bytes>")
    return "\n".join(out)


async def fleet_status():
    """Ping every machine concurrently and print a table."""
    ms = all_machines()
    results = await asyncio.gather(*(m.ping() for m in ms))
    width = max((len(m.label) for m in ms), default=10)
    print(f"{'ID':<8} {'MACHINE':<{width}} {'STATUS':<8} TOOLS")
    print("-" * (8 + width + 20))
    for m, (ok, info) in zip(ms, results):
        print(f"{m.id:<8} {m.label:<{width}} {'up' if ok else 'down':<8} {info}")
    return dict(zip((m.id for m in ms), results))


async def run_on(machine_id, language, code, timeout=120):
    """Run a snippet on one machine. language: ps / python / cmd"""
    m = pc(machine_id)
    async with m.session("B") as s:
        r = await s.call_tool("RunScript",
                              {"code": code, "language": language, "timeout": timeout})
        return clean(render(r))


async def run_on_all(language, code, timeout=120):
    """Run the same snippet on every enabled machine. Returns {id: output}."""
    ms = all_machines()

    async def one(m):
        try:
            async with m.session("B") as s:
                r = await s.call_tool("RunScript",
                                      {"code": code, "language": language, "timeout": timeout})
                return clean(render(r))
        except Exception as exc:
            return f"[ERROR] {type(exc).__name__}"

    outs = await asyncio.gather(*(one(m) for m in ms))
    return dict(zip((m.id for m in ms), outs))


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "run":
        # fleet.py run <machine|all> <ps|python|cmd> <code>
        target, lang, code = sys.argv[2], sys.argv[3], " ".join(sys.argv[4:])
        if target == "all":
            for k, v in asyncio.run(run_on_all(lang, code)).items():
                print(f"--- {k} ---\n{v}")
        else:
            print(asyncio.run(run_on(target, lang, code)))
    else:
        asyncio.run(fleet_status())
