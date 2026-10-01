"""Write normalized calendar events into the household Firestore document.

The Pi keeps the OAuth refresh tokens. This uses a Firebase service account
at /etc/homeboard/firebase-service-account.json and the household id taken
from the Firebase ID token the signed-in board posts to /api/household.
"""

import base64
import json
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HOUSEHOLD_PATH = Path("/var/lib/homeboard/household.json")
SERVICE_ACCOUNT_PATH = Path("/etc/homeboard/firebase-service-account.json")
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/datastore"
ID_TOKEN_CERTS = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
CLOCK_SKEW = 300

_token = {"value": "", "expires": 0}
_certs = {"value": {}, "expires": 0}


def household_id():
    try:
        payload = json.loads(HOUSEHOLD_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return ""
    household = str(payload.get("id") or "")
    if not household.isalnum() or not 10 <= len(household) <= 128:
        return ""
    return household


def fs_value(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [fs_value(item) for item in value]}}
    if isinstance(value, dict):
        fields = {key: fs_value(item) for key, item in value.items()}
        return {"mapValue": {"fields": fields}}
    return {"stringValue": str(value)}


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def sign_rs256(private_key_pem, message):
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
        return key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    except ImportError:
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            handle.write(private_key_pem)
            path = handle.name
        try:
            result = subprocess.run(
                ["openssl", "dgst", "-sha256", "-sign", path],
                input=message,
                capture_output=True,
                check=False,
            )
        finally:
            Path(path).unlink(missing_ok=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode() or "openssl sign failed")
        return result.stdout


def b64url_decode(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def verify_rs256(cert_pem, message, signature):
    try:
        from cryptography import x509
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
    except ImportError:
        return verify_rs256_openssl(cert_pem, message, signature)
    key = x509.load_pem_x509_certificate(cert_pem.encode()).public_key()
    try:
        key.verify(signature, message, padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature:
        return False
    return True


def verify_rs256_openssl(cert_pem, message, signature):
    with tempfile.TemporaryDirectory() as folder:
        cert_path = Path(folder) / "cert.pem"
        key_path = Path(folder) / "key.pem"
        sig_path = Path(folder) / "sig.bin"
        cert_path.write_text(cert_pem)
        sig_path.write_bytes(signature)
        pubkey = subprocess.run(
            ["openssl", "x509", "-pubkey", "-noout", "-in", str(cert_path)],
            capture_output=True,
            check=False,
        )
        if pubkey.returncode != 0:
            return False
        key_path.write_bytes(pubkey.stdout)
        result = subprocess.run(
            ["openssl", "dgst", "-sha256", "-verify", str(key_path), "-signature", str(sig_path)],
            input=message,
            capture_output=True,
            check=False,
        )
        return result.returncode == 0


def id_token_certs():
    now = time.time()
    if _certs["value"] and _certs["expires"] > now:
        return _certs["value"]
    with urllib.request.urlopen(ID_TOKEN_CERTS, timeout=20) as response:
        certs = json.loads(response.read().decode())
        max_age = 3600
        for part in (response.headers.get("Cache-Control") or "").split(","):
            name, _, value = part.strip().partition("=")
            if name == "max-age" and value.isdigit():
                max_age = int(value)
    _certs["value"] = certs
    _certs["expires"] = now + max_age
    return certs


def verify_id_token(id_token):
    """Return the Firebase uid of a valid ID token for this board's project."""
    if not SERVICE_ACCOUNT_PATH.is_file():
        raise RuntimeError("Firebase service account is not installed on this board")
    project = json.loads(SERVICE_ACCOUNT_PATH.read_text())["project_id"]
    parts = str(id_token or "").split(".")
    if len(parts) != 3:
        raise RuntimeError("Sign in to the household first")
    try:
        header = json.loads(b64url_decode(parts[0]))
        claims = json.loads(b64url_decode(parts[1]))
        signature = b64url_decode(parts[2])
    except (ValueError, json.JSONDecodeError) as error:
        raise RuntimeError("Invalid sign-in token") from error
    if header.get("alg") != "RS256":
        raise RuntimeError("Invalid sign-in token")
    cert = id_token_certs().get(header.get("kid") or "")
    if not cert or not verify_rs256(cert, f"{parts[0]}.{parts[1]}".encode(), signature):
        raise RuntimeError("Invalid sign-in token")
    now = time.time()
    if claims.get("aud") != project or claims.get("iss") != f"https://securetoken.google.com/{project}":
        raise RuntimeError("Sign-in token is for a different Firebase project")
    if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= now - CLOCK_SKEW:
        raise RuntimeError("Sign-in token has expired")
    for field in ("iat", "auth_time"):
        if not isinstance(claims.get(field), (int, float)) or claims[field] > now + CLOCK_SKEW:
            raise RuntimeError("Invalid sign-in token")
    uid = claims.get("sub")
    if not isinstance(uid, str) or not uid:
        raise RuntimeError("Invalid sign-in token")
    return uid


def access_token(account):
    now = int(time.time())
    if _token["value"] and _token["expires"] > now + 60:
        return _token["value"]
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({
        "iss": account["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
    }).encode())
    signing_input = f"{header}.{claims}".encode()
    signature = b64url(sign_rs256(account["private_key"], signing_input))
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": signing_input.decode() + "." + signature,
    }).encode()
    request = urllib.request.Request(TOKEN_URL, data=body, method="POST")
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode())
    _token["value"] = payload["access_token"]
    _token["expires"] = now + int(payload.get("expires_in", 3600))
    return _token["value"]


def push_remote_events(events):
    household = household_id()
    if not household or not SERVICE_ACCOUNT_PATH.is_file():
        return
    account = json.loads(SERVICE_ACCOUNT_PATH.read_text())
    project = account["project_id"]
    token = access_token(account)
    document = {
        "fields": {
            "remoteEvents": fs_value(events),
        }
    }
    query = urllib.parse.urlencode([("updateMask.fieldPaths", "remoteEvents")])
    url = (
        "https://firestore.googleapis.com/v1/projects/"
        f"{urllib.parse.quote(project)}/databases/(default)/documents/households/"
        f"{urllib.parse.quote(household)}?{query}"
    )
    request = urllib.request.Request(
        url,
        data=json.dumps(document).encode(),
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(detail or str(error)) from error
