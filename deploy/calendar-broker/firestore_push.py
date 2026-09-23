"""Write normalized calendar events into the household Firestore document.

The Pi keeps the OAuth refresh tokens. This uses a Firebase service account
at /etc/homeboard/firebase-service-account.json and the household id posted
by the signed-in board to /api/household.
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

_token = {"value": "", "expires": 0}


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
