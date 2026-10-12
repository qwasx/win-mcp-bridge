"""netrelay/box.py - 一次性密钥 + 混合加密（RSA-OAEP-SHA256 + AES-256-GCM）。

请求方每次生成一对一次性 RSA-3072 密钥，私钥只留在本地；runner 用公钥把结果封起来，
提交到公开仓库也没人能解开。

封包格式（二进制）：
    b"NR1\n" + JSON头一行 {"k": base64(RSA密文的AES密钥), "n": base64(nonce)} + b"\n" + AES-GCM密文
"""
import base64
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"NR1\n"
_OAEP = padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def keygen():
    """返回 (私钥PEM bytes, 公钥PEM str)。"""
    k = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    priv = k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    pub = k.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    return priv, pub.decode()


def seal(data: bytes, pub_pem: str) -> bytes:
    pub = serialization.load_pem_public_key(pub_pem.encode())
    if not isinstance(pub, rsa.RSAPublicKey) or pub.key_size < 2048:
        raise ValueError("公钥必须是至少 2048 位的 RSA 公钥")
    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, data, MAGIC)
    head = json.dumps({"k": base64.b64encode(pub.encrypt(key, _OAEP)).decode(), "n": base64.b64encode(nonce).decode()})
    return MAGIC + head.encode() + b"\n" + ct


def open_box(blob: bytes, priv_pem: bytes) -> bytes:
    if not blob.startswith(MAGIC):
        raise ValueError("不是 netrelay 封包")
    rest = blob[len(MAGIC):]
    head, ct = rest.split(b"\n", 1)
    h = json.loads(head)
    priv = serialization.load_pem_private_key(priv_pem, password=None)
    key = priv.decrypt(base64.b64decode(h["k"]), _OAEP)
    return AESGCM(key).decrypt(base64.b64decode(h["n"]), ct, MAGIC)
