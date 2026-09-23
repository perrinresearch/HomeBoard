#!/usr/bin/env python3
"""HomeBoard calendar broker.

Holds Google and Microsoft refresh tokens and fetches Apple ICS links.
Listens on 127.0.0.1:8787. nginx exposes it as /api/ on the kiosk origin.
"""
import base64
import hashlib
import json
import os
import re
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8787
ORIGIN = "http://127.0.0.1"
STATE_PATH = Path("/var/lib/homeboard/calendar.json")
PENDING_PATH = Path("/var/lib/homeboard/oauth-pending.json")
CACHE_PATH = Path("/tmp/homeboard-calendar-events.json")
ENV_PATH = Path("/etc/homeboard/calendar.env")
HOUSEHOLD_PATH = Path("/var/lib/homeboard/household.json")
HOUSEHOLD_ID = re.compile(r"^[A-Za-z0-9]{10,128}$")
SET_TIMEZONE = Path("/usr/local/lib/homeboard/set-timezone")
WIFI_HELPER = Path("/usr/local/lib/homeboard/wifi-helper")
ZONEINFO = Path("/usr/share/zoneinfo")
ZONE_NAME = re.compile(r"^[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*$")
CACHE_SECONDS = 300
WINDOW_PAST = timedelta(days=7)
WINDOW_FUTURE = timedelta(days=60)

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_API = "https://www.googleapis.com/calendar/v3"
GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly openid email"
MS_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MS_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_GRAPH = "https://graph.microsoft.com/v1.0"
MS_SCOPE = "offline_access Calendars.Read User.Read"

COLORS = {"google": "#1a73e8", "microsoft": "#0f6cbd", "apple": "#6b6258"}

# Graph returns hexColor="" when a calendar uses Outlook's automatic color, and
# only the named `color` is set. These are Outlook's swatch values.
OUTLOOK_NAMED = {
    "lightBlue": "#a4c2f4",
    "lightGreen": "#a9d18e",
    "lightOrange": "#f4b183",
    "lightGray": "#c9c9c9",
    "lightYellow": "#ffe699",
    "lightTeal": "#8fd6d6",
    "lightPink": "#f4a6c1",
    "lightBrown": "#c9a27e",
    "lightRed": "#f28b82",
    "maxColor": "#c9c9c9",
}

GOOGLE_PALETTE = {}


def normalize_color(value):
    """Return a lowercase #rrggbb, or "" if the value isn't a usable hex color."""
    text = str(value or "").strip().lstrip("#")
    if len(text) in (8, 6) and all(c in "0123456789abcdefABCDEF" for c in text):
        return "#" + text[:6].lower()
    if len(text) == 3 and all(c in "0123456789abcdefABCDEF" for c in text):
        return "#" + "".join(c * 2 for c in text).lower()
    return ""


MEMBER_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def member_ids_of(item):
    """People assigned to a calendar. Older saves stored a single familyMemberId."""
    raw = item.get("familyMemberIds") if isinstance(item, dict) else None
    ids = []
    if isinstance(raw, list):
        for value in raw:
            text = str(value or "").strip()
            if text and text not in ids and MEMBER_ID.match(text):
                ids.append(text)
    if ids:
        return ids
    single = str((item or {}).get("familyMemberId") or "").strip()
    return [single] if MEMBER_ID.match(single) else []


def write_members(item, ids):
    clean = []
    for value in ids:
        text = str(value or "").strip()
        if text and text not in clean and MEMBER_ID.match(text):
            clean.append(text)
    item["familyMemberIds"] = clean
    item["familyMemberId"] = clean[0] if len(clean) == 1 else ""


def owner_fields(item):
    ids = member_ids_of(item or {})
    return {
        "familyMemberIds": ids,
        "familyMemberId": ids[0] if len(ids) == 1 else "",
    }


def merge_calendars(existing, fresh):
    """Refresh names and colors from the provider without losing local choices."""
    known = {item["id"]: item for item in existing or []}
    merged = []
    for item in fresh:
        old = known.get(item["id"])
        if old:
            merged.append({
                **item,
                "enabled": old.get("enabled", True),
                **owner_fields(old),
            })
        else:
            merged.append({**item, "enabled": False, "familyMemberId": "", "familyMemberIds": []})
    return merged


def refresh_calendar_list(provider, account_id, lister, access):
    data = state()
    account = next((item for item in data.get(provider, []) if item.get("id") == account_id), None)
    if not account:
        return None
    try:
        fresh = lister(access)
    except Exception as error:  # noqa: BLE001 - stale colors beat no events
        print(f"could not refresh {provider} calendar list: {error}")
        return account
    merged = merge_calendars(account.get("calendars", []), fresh)
    if merged != account.get("calendars"):
        account["calendars"] = merged
        save_state(data)
    return account


def google_palette(access):
    if not GOOGLE_PALETTE:
        payload = http_json(f"{GOOGLE_API}/colors", headers={"Authorization": f"Bearer {access}"})
        for color_id, entry in (payload.get("event") or {}).items():
            color = normalize_color(entry.get("background"))
            if color:
                GOOGLE_PALETTE[color_id] = color
    return GOOGLE_PALETTE


def load_env_file():
    try:
        text = ENV_PATH.read_text()
    except OSError:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def env(name):
    return os.environ.get(name, "").strip()


def now_utc():
    return datetime.now(timezone.utc)


def utc_stamp(value):
    if not value:
        return value
    if value.endswith("Z") or "+" in value[10:] or value[10:].find("-") > 0:
        return value
    return value.split(".")[0] + "Z"


def iso(dt):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_json(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return default


def write_json(path, data, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    os.chmod(tmp, mode)
    tmp.replace(path)


def state():
    return normalize_accounts(read_json(STATE_PATH, {"google": [], "microsoft": [], "apple": []}))


def normalize_accounts(data, persist=True):
    """Keep every Google and Microsoft sign-in. Older boards stored one account each."""
    changed = False
    for provider in ("google", "microsoft"):
        raw = data.get(provider)
        if isinstance(raw, dict):
            account = dict(raw)
            account.setdefault("id", secrets.token_hex(8))
            data[provider] = [account]
            changed = True
        elif not isinstance(raw, list):
            data[provider] = []
            changed = True
    if not isinstance(data.get("apple"), list):
        data["apple"] = []
        changed = True
    if changed and persist:
        save_state(data)
    return data


def save_state(data):
    write_json(STATE_PATH, data)


def pkce():
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def http_json(url, method="GET", body=None, headers=None, form=False):
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            req_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
        else:
            data = json.dumps(body).encode()
            req_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            if not raw:
                return {}
            return json.loads(raw.decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:500]
        raise RuntimeError(f"{error.code} {detail}") from error


def http_bytes(url, limit=2_000_000):
    request = urllib.request.Request(url, headers={"User-Agent": "HomeBoard"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read(limit + 1)[:limit]


def remember_pending(provider, verifier):
    pending = read_json(PENDING_PATH, {})
    cutoff = time.time() - 900
    pending = {k: v for k, v in pending.items() if v.get("created", 0) > cutoff}
    token = secrets.token_urlsafe(24)
    pending[token] = {"provider": provider, "verifier": verifier, "created": time.time()}
    write_json(PENDING_PATH, pending)
    return token


def take_pending(token, provider):
    pending = read_json(PENDING_PATH, {})
    entry = pending.pop(token, None)
    write_json(PENDING_PATH, pending)
    if not entry or entry.get("provider") != provider:
        raise RuntimeError("Sign-in session expired. Try connecting again.")
    return entry["verifier"]


def google_redirect():
    return f"{ORIGIN}/api/google/callback"


def microsoft_redirect():
    return f"{ORIGIN}/api/microsoft/callback"


def start_google():
    client_id = env("GOOGLE_CLIENT_ID")
    if not client_id or not env("GOOGLE_CLIENT_SECRET"):
        raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing from /etc/homeboard/calendar.env")
    verifier, challenge = pkce()
    state_token = remember_pending("google", verifier)
    query = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": google_redirect(),
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "access_type": "offline",
        "prompt": "select_account consent",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state_token,
    })
    return f"{GOOGLE_AUTH}?{query}"


def start_microsoft():
    client_id = env("MICROSOFT_CLIENT_ID")
    if not client_id or not env("MICROSOFT_CLIENT_SECRET"):
        raise RuntimeError("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are missing from /etc/homeboard/calendar.env")
    verifier, challenge = pkce()
    state_token = remember_pending("microsoft", verifier)
    query = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": microsoft_redirect(),
        "response_type": "code",
        "scope": MS_SCOPE,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
        "state": state_token,
    })
    return f"{MS_AUTH}?{query}"


def exchange(url, fields):
    return http_json(url, method="POST", body=fields, form=True)


def upsert_oauth_account(provider, email, refresh_token, calendars):
    data = state()
    accounts = data.setdefault(provider, [])
    email_key = (email or "").strip().lower()
    previous = next((item for item in accounts if (item.get("email") or "").strip().lower() == email_key and email_key), None)
    if previous is None:
        if not refresh_token:
            raise RuntimeError(f"{provider.title()} did not return a refresh token. Disconnect and connect again.")
        account = {
            "id": secrets.token_hex(8),
            "email": email,
            "refresh_token": refresh_token,
            "calendars": calendars,
        }
        accounts.append(account)
    else:
        previous["email"] = email
        previous["refresh_token"] = refresh_token or previous.get("refresh_token")
        previous["calendars"] = merge_calendars(previous.get("calendars"), calendars)
        account = previous
        if not account.get("refresh_token"):
            raise RuntimeError(f"{provider.title()} did not return a refresh token. Disconnect and connect again.")
    save_state(data)
    ACCESS.pop(f"{provider}:{account['id']}", None)
    CACHE_PATH.unlink(missing_ok=True)
    return account["id"]


def finish_google(code, state_token):
    verifier = take_pending(state_token, "google")
    token = exchange(GOOGLE_TOKEN, {
        "client_id": env("GOOGLE_CLIENT_ID"),
        "client_secret": env("GOOGLE_CLIENT_SECRET"),
        "code": code,
        "code_verifier": verifier,
        "grant_type": "authorization_code",
        "redirect_uri": google_redirect(),
    })
    access = token["access_token"]
    profile = http_json(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access}"},
    )
    return upsert_oauth_account("google", profile.get("email", ""), token.get("refresh_token"), list_google_calendars(access))


def finish_microsoft(code, state_token):
    verifier = take_pending(state_token, "microsoft")
    token = exchange(MS_TOKEN, {
        "client_id": env("MICROSOFT_CLIENT_ID"),
        "client_secret": env("MICROSOFT_CLIENT_SECRET"),
        "code": code,
        "code_verifier": verifier,
        "grant_type": "authorization_code",
        "redirect_uri": microsoft_redirect(),
        "scope": MS_SCOPE,
    })
    access = token["access_token"]
    profile = http_json(f"{MS_GRAPH}/me", headers={"Authorization": f"Bearer {access}"})
    email = profile.get("mail") or profile.get("userPrincipalName") or ""
    return upsert_oauth_account("microsoft", email, token.get("refresh_token"), list_microsoft_calendars(access))


ACCESS = {}


def cached_access(provider, refresher):
    entry = ACCESS.get(provider)
    if entry and entry["expires_at"] > time.time() + 60:
        return entry["token"]
    token, expires_in = refresher()
    ACCESS[provider] = {"token": token, "expires_at": time.time() + int(expires_in or 3600)}
    return token


def google_access(account):
    refresh = account.get("refresh_token")
    if not refresh:
        raise RuntimeError("Google is not connected")

    def refresh_call():
        token = exchange(GOOGLE_TOKEN, {
            "client_id": env("GOOGLE_CLIENT_ID"),
            "client_secret": env("GOOGLE_CLIENT_SECRET"),
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        })
        return token["access_token"], token.get("expires_in", 3600)

    return cached_access(f"google:{account['id']}", refresh_call)


def microsoft_access(account):
    refresh = account.get("refresh_token")
    account_id = account.get("id")
    if not refresh:
        raise RuntimeError("Microsoft is not connected")

    def refresh_call():
        token = exchange(MS_TOKEN, {
            "client_id": env("MICROSOFT_CLIENT_ID"),
            "client_secret": env("MICROSOFT_CLIENT_SECRET"),
            "refresh_token": refresh,
            "grant_type": "refresh_token",
            "scope": MS_SCOPE,
        })
        if token.get("refresh_token"):
            data = state()
            for item in data.get("microsoft", []):
                if item.get("id") == account_id:
                    item["refresh_token"] = token["refresh_token"]
                    save_state(data)
                    break
        return token["access_token"], token.get("expires_in", 3600)

    return cached_access(f"microsoft:{account_id}", refresh_call)


def list_google_calendars(access):
    found = []
    page = None
    while True:
        query = {"minAccessRole": "reader"}
        if page:
            query["pageToken"] = page
        payload = http_json(
            f"{GOOGLE_API}/users/me/calendarList?{urllib.parse.urlencode(query)}",
            headers={"Authorization": f"Bearer {access}"},
        )
        for item in payload.get("items", []):
            found.append({
                "id": item["id"],
                "name": item.get("summaryOverride") or item.get("summary") or item["id"],
                "enabled": True,
                "color": normalize_color(item.get("backgroundColor")),
            })
        page = payload.get("nextPageToken")
        if not page:
            break
    return found


def list_microsoft_calendars(access):
    payload = http_json(
        f"{MS_GRAPH}/me/calendars",
        headers={"Authorization": f"Bearer {access}"},
    )
    return [{
        "id": item["id"],
        "name": item.get("name") or "Calendar",
        "enabled": True,
        "color": normalize_color(item.get("hexColor")) or OUTLOOK_NAMED.get(item.get("color") or "", ""),
    } for item in payload.get("value", [])]


def calendar_color(account, calendar_id, provider):
    for item in (account or {}).get("calendars", []):
        if item["id"] == calendar_id:
            return item.get("color") or COLORS[provider]
    return COLORS[provider]


def enabled_ids(account):
    return [item["id"] for item in (account or {}).get("calendars", []) if item.get("enabled", True)]


def google_account_events(account, start, end):
    access = google_access(account)
    account = refresh_calendar_list("google", account["id"], list_google_calendars, access) or account
    try:
        palette = google_palette(access)
    except Exception as error:  # noqa: BLE001 - calendar colors still apply
        print(f"could not load Google event colors: {error}")
        palette = {}
    events = []
    query = urllib.parse.urlencode({
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": iso(start),
        "timeMax": iso(end),
        "maxResults": "250",
    })
    for calendar_id in enabled_ids(account):
        name = next((c["name"] for c in account["calendars"] if c["id"] == calendar_id), calendar_id)
        calendar = next((c for c in account["calendars"] if c["id"] == calendar_id), {})
        base_color = calendar_color(account, calendar_id, "google")
        encoded = urllib.parse.quote(calendar_id, safe="")
        payload = http_json(
            f"{GOOGLE_API}/calendars/{encoded}/events?{query}",
            headers={"Authorization": f"Bearer {access}"},
        )
        for item in payload.get("items", []):
            if item.get("status") == "cancelled":
                continue
            start_at = item.get("start", {})
            end_at = item.get("end", {})
            events.append({
                "id": f"google:{account['id']}:{calendar_id}:{item.get('id')}",
                "title": item.get("summary") or "(No title)",
                "start": start_at.get("dateTime") or start_at.get("date"),
                "end": end_at.get("dateTime") or end_at.get("date"),
                "location": item.get("location") or "",
                "description": item.get("description") or "",
                "source": "google",
                "calendarName": name,
                **owner_fields(calendar),
                "color": palette.get(str(item.get("colorId") or ""), base_color),
                "allDay": "date" in start_at and "dateTime" not in start_at,
            })
    return events


def google_events(start, end):
    events = []
    for account in state().get("google", []):
        try:
            events.extend(google_account_events(account, start, end))
        except Exception as error:  # noqa: BLE001 - one Gmail account must not hide the others
            print(f"google {account.get('email')}: {error}")
    return events


def microsoft_account_events(account, start, end):
    access = microsoft_access(account)
    account = refresh_calendar_list("microsoft", account["id"], list_microsoft_calendars, access) or account
    events = []
    query = urllib.parse.urlencode({
        "startDateTime": iso(start),
        "endDateTime": iso(end),
    })
    headers = {
        "Authorization": f"Bearer {access}",
        "Prefer": 'outlook.timezone="UTC"',
    }
    for calendar_id in enabled_ids(account):
        name = next((c["name"] for c in account["calendars"] if c["id"] == calendar_id), "Outlook")
        calendar = next((c for c in account["calendars"] if c["id"] == calendar_id), {})
        base_color = calendar_color(account, calendar_id, "microsoft")
        encoded = urllib.parse.quote(calendar_id, safe="")
        payload = http_json(
            f"{MS_GRAPH}/me/calendars/{encoded}/calendarView?{query}",
            headers=headers,
        )
        for item in payload.get("value", []):
            start_at = item.get("start", {})
            end_at = item.get("end", {})
            events.append({
                "id": f"microsoft:{account['id']}:{item.get('id')}",
                "title": item.get("subject") or "(No title)",
                "start": utc_stamp(start_at.get("dateTime")),
                "end": utc_stamp(end_at.get("dateTime")),
                "location": (item.get("location") or {}).get("displayName") or "",
                "description": item.get("bodyPreview") or "",
                "source": "microsoft",
                "calendarName": name,
                **owner_fields(calendar),
                "color": base_color,
                "allDay": bool(item.get("isAllDay")),
            })
    return events


def microsoft_events(start, end):
    events = []
    for account in state().get("microsoft", []):
        try:
            events.extend(microsoft_account_events(account, start, end))
        except Exception as error:  # noqa: BLE001 - one Microsoft account must not hide the others
            print(f"microsoft {account.get('email')}: {error}")
    return events


def apple_host_ok(url):
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme in ("https", "webcal") and (host == "icloud.com" or host.endswith(".icloud.com"))


def parse_ics(raw, source_id, calendar_name, start, end):
    try:
        from icalendar import Calendar
    except ImportError as error:
        raise RuntimeError("python3-icalendar is not installed") from error
    calendar = Calendar.from_ical(raw)
    name = calendar_name
    calname = calendar.get("x-wr-calname")
    if calname:
        name = str(calname)
    color = normalize_color(calendar.get("x-apple-calendar-color")) or COLORS["apple"]
    events = []
    for component in calendar.walk("VEVENT"):
        dtstart = component.get("dtstart")
        if dtstart is None:
            continue
        master = as_datetime(dtstart.dt)
        duration = event_duration(component, master)
        for occurrence in expand_event(component, master, duration, start, end):
            events.append({
                "id": f"apple:{source_id}:{component.get('uid')}:{iso(occurrence)}",
                "title": str(component.get("summary") or "(No title)"),
                "start": iso(occurrence),
                "end": iso(occurrence + duration),
                "location": str(component.get("location") or ""),
                "description": str(component.get("description") or ""),
                "source": "apple",
                "calendarName": name or "Apple",
                "color": color,
                "allDay": not isinstance(dtstart.dt, datetime),
            })
    return events, name or "Apple", color


def as_datetime(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)


def event_duration(component, master):
    dtend = component.get("dtend")
    if dtend is not None:
        return as_datetime(dtend.dt) - master
    duration = component.get("duration")
    if duration is not None:
        return duration.dt
    return timedelta(hours=1)


def expand_event(component, master, duration, window_start, window_end):
    rule = component.get("rrule")
    if rule is None:
        if window_start <= master <= window_end:
            return [master]
        return []
    data = rule.to_ical().decode()
    parts = {}
    for piece in data.split(";"):
        if "=" in piece:
            key, value = piece.split("=", 1)
            parts[key.upper()] = value
    freq = parts.get("FREQ", "DAILY")
    interval = max(1, int(parts.get("INTERVAL", "1") or "1"))
    count = int(parts["COUNT"]) if "COUNT" in parts else None
    until = None
    if "UNTIL" in parts:
        until_raw = parts["UNTIL"]
        if len(until_raw) == 8:
            until = datetime.strptime(until_raw, "%Y%m%d").replace(tzinfo=timezone.utc)
        else:
            until = datetime.strptime(until_raw[:15], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    step = {
        "DAILY": timedelta(days=interval),
        "WEEKLY": timedelta(weeks=interval),
    }.get(freq)
    found = []
    cursor = master
    seen = 0
    if freq == "DAILY" and cursor < window_start:
        jump = max(0, (window_start - cursor).days // interval)
        cursor = cursor + timedelta(days=jump * interval)
        seen += jump
    elif freq == "WEEKLY" and cursor < window_start:
        jump = max(0, (window_start - cursor).days // (7 * interval))
        cursor = cursor + timedelta(weeks=jump * interval)
        seen += jump
    while cursor <= window_end and len(found) < 400:
        if until and cursor > until:
            break
        if count is not None and seen >= count:
            break
        if cursor >= window_start:
            found.append(cursor)
        seen += 1
        if freq == "MONTHLY":
            month = cursor.month - 1 + interval
            year = cursor.year + month // 12
            month = month % 12 + 1
            day = min(cursor.day, 28)
            cursor = cursor.replace(year=year, month=month, day=day)
        elif step is None:
            break
        else:
            cursor = cursor + step
    return found


def apple_events(start, end):
    events = []
    data = state()
    changed = False
    for feed in data.get("apple", []):
        url = feed["url"].replace("webcal://", "https://", 1)
        parsed, name, color = parse_ics(http_bytes(url), feed["id"], feed.get("name") or "Apple", start, end)
        if name and name != feed.get("name"):
            feed["name"] = name
            changed = True
        if color != feed.get("color"):
            feed["color"] = color
            changed = True
        fields = owner_fields(feed)
        for event in parsed:
            event.update(fields)
        events.extend(parsed)
    if changed:
        save_state(data)
    return events


def remember_household(household_id):
    household_id = (household_id or "").strip()
    if not HOUSEHOLD_ID.match(household_id):
        raise RuntimeError("Invalid household id")
    write_json(HOUSEHOLD_PATH, {"id": household_id})
    return household_id


def publish_events():
    payload = collect_events()
    try:
        from firestore_push import push_remote_events
        push_remote_events(payload.get("events") or [])
    except Exception as error:  # noqa: BLE001 - calendar reads must still succeed
        print("firestore push failed:", error)
    return payload


def collect_events():
    cached = read_json(CACHE_PATH, None)
    if cached and cached.get("expires", 0) > time.time():
        return cached["payload"]
    start = now_utc() - WINDOW_PAST
    end = now_utc() + WINDOW_FUTURE
    events = []
    errors = []
    for provider, fetcher in (
        ("google", google_events),
        ("microsoft", microsoft_events),
        ("apple", apple_events),
    ):
        try:
            events.extend(fetcher(start, end))
        except Exception as error:  # noqa: BLE001 - one provider must not blank the others
            errors.append({"provider": provider, "message": str(error)})
    payload = {"events": events, "errors": errors}
    write_json(CACHE_PATH, {"expires": time.time() + CACHE_SECONDS, "payload": payload}, mode=0o644)
    return payload


def public_account(account):
    if not account:
        return None
    return {
        "id": account.get("id") or "",
        "connected": True,
        "email": account.get("email") or "",
        "calendars": [
            {
                "id": item["id"],
                "name": item.get("name") or item["id"],
                "enabled": bool(item.get("enabled", True)),
                **owner_fields(item),
                "color": item.get("color") or "",
            }
            for item in account.get("calendars", [])
        ],
    }


def sources_payload():
    data = state()
    return {
        "google": [public_account(item) for item in data.get("google", [])],
        "microsoft": [public_account(item) for item in data.get("microsoft", [])],
        "apple": [{
            "id": item["id"],
            "name": item.get("name") or "Apple",
            **owner_fields(item),
            "color": item.get("color") or COLORS["apple"],
        } for item in data.get("apple", [])],
    }


def set_owner(provider, calendar_id, family_member_id, account_id="", members=None, action="set"):
    data = state()
    if provider == "apple":
        item = next((entry for entry in data.get("apple", []) if entry["id"] == calendar_id), None)
    else:
        item = find_calendar(data, provider, calendar_id, account_id)
    if not item:
        raise RuntimeError("Calendar not found")
    current = member_ids_of(item)
    if isinstance(members, list):
        write_members(item, members)
    elif action == "add":
        if not family_member_id:
            raise RuntimeError("Choose a person")
        write_members(item, current + [family_member_id])
    elif action == "remove":
        write_members(item, [value for value in current if value != family_member_id])
    else:
        write_members(item, [family_member_id] if family_member_id else [])
    save_state(data)
    CACHE_PATH.unlink(missing_ok=True)


def find_calendar(data, provider, calendar_id, account_id=""):
    for account in data.get(provider, []):
        if account_id and account.get("id") != account_id:
            continue
        for item in account.get("calendars", []):
            if item["id"] == calendar_id:
                return item
    return None


def set_enabled(provider, calendar_id, enabled, account_id=""):
    data = state()
    item = find_calendar(data, provider, calendar_id, account_id)
    if not item:
        raise RuntimeError("Calendar not found")
    item["enabled"] = bool(enabled)
    save_state(data)
    CACHE_PATH.unlink(missing_ok=True)


def add_apple(url):
    cleaned = (url or "").strip()
    if not apple_host_ok(cleaned):
        raise RuntimeError("Apple links must be https or webcal links on icloud.com")
    fetch_url = cleaned.replace("webcal://", "https://", 1)
    start = now_utc() - WINDOW_PAST
    end = now_utc() + WINDOW_FUTURE
    feed_id = secrets.token_hex(8)
    _, name, color = parse_ics(http_bytes(fetch_url), feed_id, "Apple", start, end)
    data = state()
    data.setdefault("apple", []).append({"id": feed_id, "name": name, "url": cleaned, "color": color})
    save_state(data)
    CACHE_PATH.unlink(missing_ok=True)
    return {"id": feed_id, "name": name, "color": color}


def delete_apple(feed_id):
    data = state()
    data["apple"] = [item for item in data.get("apple", []) if item["id"] != feed_id]
    save_state(data)
    CACHE_PATH.unlink(missing_ok=True)


def disconnect(provider, account_id):
    data = state()
    accounts = data.get(provider) or []
    kept = [item for item in accounts if item.get("id") != account_id]
    if len(kept) == len(accounts):
        raise RuntimeError("Account not found")
    data[provider] = kept
    save_state(data)
    ACCESS.pop(f"{provider}:{account_id}", None)
    CACHE_PATH.unlink(missing_ok=True)


def valid_timezone(zone):
    if not zone or not ZONE_NAME.match(zone) or ".." in zone or zone.startswith("/"):
        return False
    path = ZONEINFO / zone
    try:
        if not path.is_file():
            return False
        return path.resolve().is_relative_to(ZONEINFO.resolve())
    except (OSError, ValueError):
        return False


def current_timezone():
    try:
        result = subprocess.run(
            ["timedatectl", "show", "-p", "Timezone", "--value"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        zone = result.stdout.strip()
        if result.returncode == 0 and zone:
            return zone
    except (OSError, subprocess.TimeoutExpired):
        pass
    try:
        link = os.readlink("/etc/localtime")
    except OSError:
        link = ""
    marker = "/zoneinfo/"
    if marker in link:
        return link.split(marker, 1)[1]
    try:
        return Path("/etc/timezone").read_text().strip() or "UTC"
    except OSError:
        return "UTC"


def list_timezones():
    try:
        result = subprocess.run(
            ["timedatectl", "list-timezones"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if valid_timezone(line.strip())]


def set_timezone(zone):
    zone = (zone or "").strip()
    if not valid_timezone(zone):
        raise RuntimeError("Unknown timezone")
    if zone == current_timezone():
        return zone
    if not SET_TIMEZONE.is_file():
        raise RuntimeError("Timezone helper is not installed on this board")
    result = subprocess.run(
        ["sudo", "-n", str(SET_TIMEZONE), zone],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Could not set the timezone").strip()
        raise RuntimeError(detail.splitlines()[-1])
    return current_timezone()


def command_path(name):
    for folder in ("/usr/sbin", "/sbin", "/usr/bin", "/bin"):
        path = Path(folder) / name
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    return name


def run_cmd(args, timeout=10):
    try:
        return subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def wifi_iface():
    result = run_cmd([command_path("iw"), "dev"], timeout=8)
    if result and result.returncode == 0:
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) == 2 and parts[0] == "Interface" and re.match(r"^[A-Za-z0-9._-]+$", parts[1]):
                return parts[1]
    return "wlan0"


def read_wifi_status():
    iface = wifi_iface()
    connected = False
    ssid = ""
    signal = None
    result = run_cmd([command_path("iw"), "dev", iface, "link"], timeout=8)
    if result and result.returncode == 0:
        for line in result.stdout.splitlines():
            stripped = line.strip()
            if stripped.startswith("SSID:"):
                ssid = stripped.split(":", 1)[1].strip()
                connected = bool(ssid)
            elif stripped.startswith("signal:"):
                match = re.search(r"(-?\d+)", stripped)
                if match:
                    signal = int(match.group(1))
            elif stripped.startswith("Connected to ") and "SSID:" not in result.stdout:
                connected = True
    ip = ""
    addr = run_cmd([command_path("ip"), "-4", "-o", "addr", "show", "dev", iface], timeout=5)
    if addr and addr.returncode == 0:
        match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", addr.stdout)
        if match:
            ip = match.group(1)
    if not ssid and not ip:
        connected = False
    return {
        "connected": connected,
        "ssid": ssid,
        "ip": ip,
        "signal": signal,
        "iface": iface,
    }


def run_wifi(args, stdin=None, timeout=20):
    if not WIFI_HELPER.is_file():
        raise RuntimeError("Wi-Fi helper is not installed on this board")
    result = subprocess.run(
        ["sudo", "-n", str(WIFI_HELPER), *args],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Wi-Fi request failed").strip()
        raise RuntimeError(detail.splitlines()[-1] if detail else "Wi-Fi request failed")
    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError as error:
        raise RuntimeError("Wi-Fi helper returned invalid data") from error


def format_wifi(data):
    return {
        "ok": True,
        "connected": bool(data.get("connected")),
        "ssid": str(data.get("ssid") or ""),
        "ip": str(data.get("ip") or ""),
        "signal": data.get("signal"),
        "iface": str(data.get("iface") or ""),
    }


def wifi_status():
    # Status does not need root. Avoid sudo so Settings still works if the
    # helper or sudoers file was not installed yet.
    return format_wifi(read_wifi_status())


def wifi_scan():
    data = run_wifi(["scan"], timeout=30)
    networks = []
    for item in data.get("networks") or []:
        ssid = str(item.get("ssid") or "").strip()
        if not ssid:
            continue
        signal = item.get("signal")
        networks.append({
            "ssid": ssid,
            "signal": int(signal) if isinstance(signal, (int, float)) else None,
            "security": "wpa" if item.get("security") == "wpa" else "open",
        })
    return {"networks": networks}


def set_wifi(ssid, password):
    ssid = str(ssid or "").strip()
    password = str(password or "")
    if not ssid or "\n" in ssid or "\r" in ssid:
        raise RuntimeError("Enter a Wi-Fi name")
    if len(ssid.encode("utf-8")) > 32:
        raise RuntimeError("Wi-Fi name is too long")
    if password:
        if "\n" in password or "\r" in password:
            raise RuntimeError("Invalid Wi-Fi password")
        if not 8 <= len(password) <= 63:
            raise RuntimeError("Password must be 8 to 63 characters")
    return format_wifi(run_wifi(["apply"], stdin=json.dumps({"ssid": ssid, "password": password}), timeout=45))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, message, status=400):
        body = f"<!doctype html><meta charset=utf-8><title>HomeBoard</title><p>{message}</p><p><a href='/'>Back to HomeBoard</a></p>".encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(min(length, 100_000))
        return json.loads(raw.decode() or "{}")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if path == "/health":
                self.send_json({"ok": True})
            elif path == "/sources":
                self.send_json(sources_payload())
            elif path == "/events":
                self.send_json(publish_events())
            elif path == "/household":
                self.send_json({"id": read_json(HOUSEHOLD_PATH, {}).get("id") or ""})
            elif path == "/timezone":
                self.send_json({"timezone": current_timezone()})
            elif path == "/timezones":
                self.send_json({"timezones": list_timezones()})
            elif path == "/wifi":
                self.send_json(wifi_status())
            elif path == "/wifi/scan":
                self.send_json(wifi_scan())
            elif path == "/google/start":
                self.redirect(start_google())
            elif path == "/microsoft/start":
                self.redirect(start_microsoft())
            elif path == "/google/callback":
                account_id = finish_google(query.get("code", [""])[0], query.get("state", [""])[0])
                self.redirect(f"/?connected=google&account={urllib.parse.quote(account_id)}")
            elif path == "/microsoft/callback":
                account_id = finish_microsoft(query.get("code", [""])[0], query.get("state", [""])[0])
                self.redirect(f"/?connected=microsoft&account={urllib.parse.quote(account_id)}")
            else:
                self.send_json({"error": "Not found"}, 404)
        except Exception as error:  # noqa: BLE001
            if path.endswith("/callback"):
                self.send_html(str(error), 400)
            else:
                self.send_json({"error": str(error)}, 400)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        try:
            body = self.read_body()
            if path == "/apple":
                self.send_json(add_apple(body.get("url", "")))
            elif path == "/owner":
                raw_members = body.get("familyMemberIds", None)
                set_owner(
                    body.get("provider", ""),
                    body.get("id", ""),
                    body.get("familyMemberId", ""),
                    body.get("accountId", ""),
                    raw_members if isinstance(raw_members, list) else None,
                    body.get("action") or "set",
                )
                self.send_json(sources_payload())
            elif path == "/google/calendars":
                set_enabled("google", body.get("id", ""), body.get("enabled", True), body.get("accountId", ""))
                self.send_json(sources_payload())
            elif path == "/microsoft/calendars":
                set_enabled("microsoft", body.get("id", ""), body.get("enabled", True), body.get("accountId", ""))
                self.send_json(sources_payload())
            elif path == "/timezone":
                zone = set_timezone(body.get("timezone", ""))
                self.send_json({"timezone": zone, "reload": True})
            elif path == "/wifi":
                self.send_json(set_wifi(body.get("ssid", ""), body.get("password", "")))
            elif path == "/household":
                self.send_json({"id": remember_household(body.get("id", ""))})
            else:
                self.send_json({"error": "Not found"}, 404)
        except Exception as error:  # noqa: BLE001
            self.send_json({"error": str(error)}, 400)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if path == "/google":
                disconnect("google", query.get("id", [""])[0])
            elif path == "/microsoft":
                disconnect("microsoft", query.get("id", [""])[0])
            elif path == "/apple":
                delete_apple(query.get("id", [""])[0])
            else:
                self.send_json({"error": "Not found"}, 404)
                return
            self.send_json(sources_payload())
        except Exception as error:  # noqa: BLE001
            self.send_json({"error": str(error)}, 400)


def main():
    load_env_file()
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"HomeBoard calendar broker on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
