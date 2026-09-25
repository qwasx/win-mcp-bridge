"""
tokens.py - local token bookkeeping for the security runbook.
Everything lives in ~/.cache/pc-relay/ (mode 600), never in the repo, never printed.

    python relay/tokens.py status                 fingerprints only (sha256[:8])
    python relay/tokens.py extract <result.md>    direct mode: pull NEW_TOKENS_JSON out of a result file
    python relay/tokens.py promote                pc1.json: switch to the new desktop token (old one kept as token_old)
    python relay/tokens.py demote                 undo promote (after an automatic rollback on the PC)
    python relay/tokens.py push-secrets [--repo OWNER/NAME]
                                                  gh secret set PC1_URL / PC1_DESKTOP_TOKEN / PC1_BRIDGE_TOKEN (values via stdin)
    python relay/tokens.py shred                  delete every local copy of URL/tokens
"""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

KEY_DIR = Path(os.environ.get("PC_RELAY_KEY_DIR", Path.home() / ".cache" / "pc-relay"))
CRED = KEY_DIR / "pc1.json"
NEW = KEY_DIR / "new_tokens.json"
MARK = "NEW_TOKENS_JSON:"


def fp(v):
    return hashlib.sha256(v.encode()).hexdigest()[:8] if v else "-"


def load(p):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def save(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f)


def main(argv):
    cmd = argv[0] if argv else "-h"
    if cmd == "status":
        c, n = load(CRED) or {}, load(NEW) or {}
        print(f"pc1.json        url={'set' if c.get('url') else '-'} token={fp(c.get('token'))} "
              f"token_old={fp(c.get('token_old'))}")
        print(f"new_tokens.json desktop={fp(n.get('desktop'))} bridge={fp(n.get('bridge'))}")
    elif cmd == "extract" and len(argv) == 2:
        for ln in Path(argv[1]).read_text(encoding="utf-8").splitlines():
            if ln.startswith(MARK):
                save(NEW, json.loads(ln[len(MARK):]))
                print(f"saved {NEW}")
                return 0
        sys.exit("no NEW_TOKENS_JSON line in that file")
    elif cmd == "promote":
        c, n = load(CRED), load(NEW)
        if not c or not n:
            sys.exit("need both pc1.json and new_tokens.json")
        if c.get("token") != n["desktop"]:
            c["token_old"], c["token"] = c.get("token"), n["desktop"]
            save(CRED, c)
        print(f"pc1.json now uses the new desktop token ({fp(n['desktop'])})")
    elif cmd == "demote":
        c = load(CRED)
        if not c or not c.get("token_old"):
            sys.exit("nothing to demote")
        c["token"] = c.pop("token_old")
        save(CRED, c)
        print(f"pc1.json back on the old token ({fp(c['token'])})")
    elif cmd == "push-secrets":
        repo = argv[argv.index("--repo") + 1] if "--repo" in argv else None
        c, n = load(CRED), load(NEW)
        if not c or not n:
            sys.exit("need both pc1.json (url) and new_tokens.json")
        for name, val in (("PC1_URL", c["url"]), ("PC1_DESKTOP_TOKEN", n["desktop"]),
                          ("PC1_BRIDGE_TOKEN", n["bridge"])):
            args = ["gh", "secret", "set", name] + (["--repo", repo] if repo else [])
            r = subprocess.run(args, input=val, text=True, capture_output=True)
            print(f"{name}: {'ok' if r.returncode == 0 else 'FAILED ' + r.stderr.strip()[:200]}")
            if r.returncode:
                return 1
    elif cmd == "shred":
        for p in [CRED, NEW, *KEY_DIR.glob("*.md")]:
            if p.exists():
                size = p.stat().st_size
                with open(p, "r+b") as f:
                    f.write(os.urandom(size))
                p.unlink()
                print(f"removed {p}")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
