"""
crypto_box.py - seal relay results so they can live in a PUBLIC repo.

RSA-OAEP(SHA-256) wraps a random 256-bit key; AES-256-GCM encrypts the data.
The requester generates a fresh key pair per session, publishes only the
public key (in relay/request.json) and keeps the private key outside the repo.

    python crypto_box.py keygen   <private_key_path>      -> prints public PEM
    python crypto_box.py seal     <public_pem_file> <in> <out>
    python crypto_box.py open     <private_key_path> <in>  -> plaintext to stdout
"""

import base64
import json
import os
import sys

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

OAEP = padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
B64 = lambda b: base64.b64encode(b).decode("ascii")


def keygen(priv_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    os.makedirs(os.path.dirname(os.path.abspath(priv_path)), exist_ok=True)
    fd = os.open(priv_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(key.private_bytes(serialization.Encoding.PEM,
                                  serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption()))
    return key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode("ascii")


def seal(pub_pem: bytes, data: bytes) -> dict:
    pub = serialization.load_pem_public_key(pub_pem)
    if not isinstance(pub, rsa.RSAPublicKey) or pub.key_size < 3072:
        raise ValueError("need an RSA public key of at least 3072 bits")
    k, nonce = AESGCM.generate_key(256), os.urandom(12)
    return {"v": 1, "alg": "RSA-OAEP-256+A256GCM",
            "key": B64(pub.encrypt(k, OAEP)), "nonce": B64(nonce),
            "ct": B64(AESGCM(k).encrypt(nonce, data, None))}


def open_box(priv_pem: bytes, box: dict) -> bytes:
    priv = serialization.load_pem_private_key(priv_pem, password=None)
    k = priv.decrypt(base64.b64decode(box["key"]), OAEP)
    return AESGCM(k).decrypt(base64.b64decode(box["nonce"]),
                             base64.b64decode(box["ct"]), None)


if __name__ == "__main__":
    cmd, *a = sys.argv[1:] or ["-h"]
    if cmd == "keygen" and len(a) == 1:
        print(keygen(a[0]), end="")
    elif cmd == "seal" and len(a) == 3:
        box = seal(open(a[0], "rb").read(), open(a[1], "rb").read())
        with open(a[2], "w", encoding="ascii") as f:
            json.dump(box, f)
    elif cmd == "open" and len(a) == 2:
        sys.stdout.buffer.write(open_box(open(a[0], "rb").read(),
                                         json.load(open(a[1], encoding="ascii"))))
    else:
        print(__doc__)
        sys.exit(1)
