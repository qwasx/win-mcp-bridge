"""
handshake.py - runner side of the credential hand-off (used when the repo has
no PC1_* secrets configured).

1. Generate a one-time RSA key pair inside the runner (private key never
   leaves the ephemeral VM).
2. Commit relay/handshake/<id>.runner.pub.pem to the branch.
3. Poll the branch for relay/handshake/<id>.cred.enc.json, sealed by the
   requester with that public key: {"url": ..., "token": ...}.
4. Decrypt, mask the values in the Actions log, write them to files in
   $RUNNER_TEMP for the next step.

Anyone reading the public repo sees only a public key and ciphertext; the key
that can open it died with the runner.

    python relay/handshake.py <id> <branch> [--wait 300]
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crypto_box  # noqa: E402


def git(*a, check=True):
    r = subprocess.run(["git", *a], capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"git {a[0]} failed: {r.stderr.strip()[:300]}")
    return r


def main():
    rid, branch = sys.argv[1], sys.argv[2]
    wait = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[3] == "--wait" else 300
    tmp = Path(os.environ["RUNNER_TEMP"])
    priv = tmp / "runner_key.pem"
    pub = crypto_box.keygen(str(priv))

    hs = Path("relay/handshake")
    hs.mkdir(parents=True, exist_ok=True)
    pub_path = hs / f"{rid}.runner.pub.pem"
    pub_path.write_text(pub)
    git("add", "-f", str(pub_path))   # *.pem is gitignored; this one is PUBLIC
    git("commit", "-q", "-m", f"relay: runner public key {rid}")
    for i in range(5):
        if (git("pull", "-q", "--rebase", "origin", branch, check=False).returncode == 0
                and git("push", "-q", "origin", f"HEAD:{branch}", check=False).returncode == 0):
            break
        time.sleep(3 * (i + 1))
    else:
        sys.exit("could not publish runner public key")
    print("runner public key published; waiting for sealed credentials", flush=True)

    target = f"relay/handshake/{rid}.cred.enc.json"
    t0 = time.time()
    while time.time() - t0 < wait:
        time.sleep(5)
        if git("fetch", "-q", "origin", branch, check=False).returncode:
            continue
        r = git("show", f"FETCH_HEAD:{target}", check=False)
        if r.returncode == 0:
            cred = json.loads(crypto_box.open_box(priv.read_bytes(), json.loads(r.stdout)))
            url, token = cred["url"].strip(), cred["token"].strip()
            # mask BEFORE anything could print them
            print(f"::add-mask::{token}")
            print(f"::add-mask::{url}")
            (tmp / "pc_url").write_text(url)
            (tmp / "pc_token").write_text(token)
            os.chmod(tmp / "pc_token", 0o600)
            priv.unlink()
            print(f"credentials received after {time.time() - t0:.0f}s", flush=True)
            return 0
    sys.exit("timed out waiting for sealed credentials")


if __name__ == "__main__":
    sys.exit(main())
