"""
ask.py - requester side of the GitHub Actions relay (run in the agent sandbox).

    python relay/ask.py <list_tools|read_start_here|verify> [--wait 900]

1. Ensures a session key pair exists OUTSIDE the repo (~/.cache/pc-relay/).
2. Writes relay/request.json {id, task, pubkey}, commits, pushes the branch.
   That push triggers .github/workflows/pc-relay.yml.
3. Polls the branch until the workflow commits relay/results/<id>.enc.json,
   then decrypts it locally and prints it.

If ~/.cache/pc-relay/pc1.json exists and the repo has no PC1_* secrets, the
runner publishes a one-time public key and this script answers with the
credentials sealed to it (see relay/handshake.py).

The private key never enters the repo. Old sealed results are removed from
the working tree with each new request (they stay unreadable in history).
"""

import argparse
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
import crypto_box  # noqa: E402

KEY_DIR = Path(os.environ.get("PC_RELAY_KEY_DIR", Path.home() / ".cache" / "pc-relay"))
PRIV = KEY_DIR / "session_key.pem"
PUB = KEY_DIR / "session_key.pub.pem"
CRED = KEY_DIR / "pc1.json"      # {"url": ..., "token": ...}, never committed
TASKS = ("list_tools", "read_start_here", "verify")


def git(*args, check=True):
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout.strip()


def ensure_key():
    if PRIV.exists() and PUB.exists():
        return PUB.read_text()
    pub = crypto_box.keygen(str(PRIV))
    PUB.write_text(pub)
    return pub


def repo_slug():
    url = git("remote", "get-url", "origin")
    return url.rstrip("/").removesuffix(".git").split("github.com")[-1].strip("/:")


def run_status(slug, sha):
    """Best-effort: public Actions API, no auth needed for public repos."""
    try:
        u = f"https://api.github.com/repos/{slug}/actions/runs?head_sha={sha}&per_page=5"
        with urllib.request.urlopen(u, timeout=15) as r:
            runs = json.load(r).get("workflow_runs", [])
        runs = [x for x in runs if x.get("name") == "pc-relay"]
        if runs:
            x = runs[0]
            return x["status"], x.get("conclusion"), x["html_url"]
    except Exception:
        pass
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("task", choices=TASKS)
    ap.add_argument("--wait", type=int, default=900, help="seconds to wait for the result")
    a = ap.parse_args()

    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    slug = repo_slug()
    pub = ensure_key()
    rid = time.strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(4)

    git("fetch", "-q", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}")
    git("rebase", "-q", f"origin/{branch}", check=False)

    stale = [*(HERE / "results").glob("*.enc.json"), *(HERE / "handshake").glob("*")]
    for old in stale:
        git("rm", "-q", "--ignore-unmatch", "-f", str(old.relative_to(REPO)), check=False)
        old.unlink(missing_ok=True)

    (HERE / "request.json").write_text(json.dumps(
        {"id": rid, "task": a.task, "pubkey": pub,
         "requested_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")},
        indent=2) + "\n", encoding="utf-8")
    git("add", "relay/request.json")
    git("commit", "-q", "-m", f"relay: request {a.task} {rid}")
    git("push", "-q", "origin", f"HEAD:{branch}")
    sha = git("rev-parse", "HEAD")
    print(f"requested task={a.task} id={rid} commit={sha[:9]}", flush=True)

    target = f"relay/results/{rid}.enc.json"
    runner_pub = f"relay/handshake/{rid}.runner.pub.pem"
    sent_cred = False
    t0, last = time.time(), None
    while time.time() - t0 < a.wait:
        time.sleep(5)
        git("fetch", "-q", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}")
        if not sent_cred and CRED.exists():
            r = subprocess.run(["git", "show", f"origin/{branch}:{runner_pub}"],
                               cwd=REPO, capture_output=True, text=True)
            if r.returncode == 0:
                author = git("log", "-1", "--format=%an", f"origin/{branch}", "--", runner_pub)
                if author != "github-actions[bot]":
                    sys.exit(f"refusing: runner key committed by {author!r}")
                box = crypto_box.seal(r.stdout.encode(), CRED.read_bytes())
                git("rebase", "-q", f"origin/{branch}")
                out = REPO / f"relay/handshake/{rid}.cred.enc.json"
                out.write_text(json.dumps(box), encoding="ascii")
                git("add", str(out.relative_to(REPO)))
                git("commit", "-q", "-m", f"relay: sealed credentials {rid}")
                git("push", "-q", "origin", f"HEAD:{branch}")
                sent_cred = True
                print(f"  sent sealed credentials ({time.time() - t0:.0f}s)", flush=True)
                continue
        if subprocess.run(["git", "cat-file", "-e", f"origin/{branch}:{target}"],
                          cwd=REPO, capture_output=True).returncode == 0:
            git("rebase", "-q", f"origin/{branch}")
            box = json.loads((REPO / target).read_text(encoding="ascii"))
            text = crypto_box.open_box(PRIV.read_bytes(), box).decode("utf-8", "replace")
            (KEY_DIR / f"{rid}.md").write_text(text, encoding="utf-8")
            print(f"--- result ({time.time() - t0:.0f}s) ---")
            print(text)
            return 0
        st = run_status(slug, sha)
        if st and st != last:
            print(f"  workflow: {st[0]} {st[1] or ''} {st[2]}", flush=True)
            last = st
            if st[0] == "completed" and st[1] not in ("success", None):
                print("workflow failed before sealing a result; open the URL above.")
                return 2
    print("timed out waiting for the result.")
    if last is None:
        print("no workflow run seen - Actions may be disabled, or the workflow file "
              "was not accepted on this branch.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
