#!/usr/bin/env python3
"""Draw the sign-in keyboard on Google and Microsoft login pages.

Chromium no longer honors --load-extension in kiosk mode, so the extension
never appears. This talks to the browser's local DevTools port and installs
deploy/oauth-keyboard/keyboard.js into each page instead.
"""

import base64
import hashlib
import json
import os
import socket
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HOST = "127.0.0.1"
PORT = 9222
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
SKIP_PREFIXES = ("chrome:", "devtools:", "chrome-extension:", "chrome-untrusted:")


def log(message):
    print(f"{time.strftime('%H:%M:%S')} {message}", flush=True)


def script_path():
    candidates = [
        Path("/usr/local/share/homeboard/oauth-keyboard/keyboard.js"),
        Path(__file__).resolve().parent / "oauth-keyboard" / "keyboard.js",
    ]
    for path in candidates:
        if path.is_file():
            return path
    raise FileNotFoundError("oauth keyboard.js is not installed")


def load_source():
    return script_path().read_text(encoding="utf-8") + "\n//# sourceURL=homeboard-oauth-keyboard.js\n"


def read_exact(sock, count):
    chunks = []
    remaining = count
    while remaining:
        piece = sock.recv(remaining)
        if not piece:
            raise ConnectionError("socket closed")
        chunks.append(piece)
        remaining -= len(piece)
    return b"".join(chunks)


def read_headers(sock):
    data = b""
    while b"\r\n\r\n" not in data:
        piece = sock.recv(4096)
        if not piece:
            raise ConnectionError("socket closed during handshake")
        data += piece
        if len(data) > 65536:
            raise ConnectionError("handshake too large")
    head, rest = data.split(b"\r\n\r\n", 1)
    return head.decode("iso-8859-1", "replace"), rest


class WebSocket:
    def __init__(self, url):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("ws", "http"):
            raise ValueError(f"unsupported debugger url {url}")
        port = parsed.port or 80
        self.sock = socket.create_connection((parsed.hostname, port), timeout=10)
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        key = base64.b64encode(os.urandom(16)).decode()
        host = f"{parsed.hostname}:{port}"
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            f"Origin: http://{host}\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        head, extra = read_headers(self.sock)
        if " 101 " not in head.split("\r\n", 1)[0]:
            raise ConnectionError(head.split("\r\n", 1)[0])
        self.buffer = extra
        self.sock.settimeout(None)

    def send_text(self, text):
        payload = text.encode()
        header = bytearray([0x81])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(length.to_bytes(2, "big"))
        else:
            header.append(0x80 | 127)
            header.extend(length.to_bytes(8, "big"))
        mask = os.urandom(4)
        header.extend(mask)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        self.sock.sendall(header + masked)

    def recv_text(self):
        while True:
            frame = self._recv_frame()
            opcode = frame[0]
            payload = frame[1]
            if opcode == 0x1:
                return payload.decode()
            if opcode == 0x8:
                raise ConnectionError("websocket closed")
            if opcode == 0x9:
                self._send_frame(0xA, payload)

    def _recv_frame(self):
        while True:
            header = self._read(2)
            opcode = header[0] & 0x0F
            masked = header[1] & 0x80
            length = header[1] & 0x7F
            if length == 126:
                length = int.from_bytes(self._read(2), "big")
            elif length == 127:
                length = int.from_bytes(self._read(8), "big")
            mask = self._read(4) if masked else b""
            payload = self._read(length)
            if mask:
                payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
            if opcode == 0x0:
                continue
            return opcode, payload

    def _read(self, count):
        while len(self.buffer) < count:
            piece = self.sock.recv(65536)
            if not piece:
                raise ConnectionError("socket closed")
            self.buffer += piece
        chunk, self.buffer = self.buffer[:count], self.buffer[count:]
        return chunk

    def _send_frame(self, opcode, payload):
        header = bytearray([0x80 | opcode])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(length.to_bytes(2, "big"))
        else:
            header.append(0x80 | 127)
            header.extend(length.to_bytes(8, "big"))
        mask = os.urandom(4)
        header.extend(mask)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        self.sock.sendall(header + masked)

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.load(response)


def interesting(info):
    if not info or info.get("type") != "page":
        return False
    url = info.get("url") or ""
    return not url.startswith(SKIP_PREFIXES)


def run_session(host=HOST, port=PORT):
    version = fetch_json(f"http://{host}:{port}/json/version")
    ws_url = version["webSocketDebuggerUrl"]
    source = load_source()
    ws = WebSocket(ws_url)
    log(f"connected {version.get('Browser', 'chromium')}")
    try:
        pump(ws, source)
    finally:
        ws.close()


def pump(ws, source):
    next_id = 1
    inflight = {}
    attached = set()
    injected = set()

    def send(method, params=None, session_id=None, kind=None):
        nonlocal next_id
        message_id = next_id
        next_id += 1
        message = {"id": message_id, "method": method, "params": params or {}}
        if session_id:
            message["sessionId"] = session_id
        inflight[message_id] = kind or (method,)
        ws.send_text(json.dumps(message))
        return message_id

    def inject(session_id, url):
        if session_id in injected:
            return
        injected.add(session_id)
        log(f"install keyboard for {url[:140]}")
        send(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": source},
            session_id,
            ("script", session_id),
        )
        send(
            "Runtime.evaluate",
            {"expression": source, "returnByValue": True},
            session_id,
            ("eval", session_id),
        )

    send("Target.setDiscoverTargets", {"discover": True}, kind=("discover",))

    while True:
        message = json.loads(ws.recv_text())
        if "id" in message and message["id"] in inflight:
            kind = inflight.pop(message["id"])
            if "error" in message:
                log(f"{kind[0]} failed: {message['error'].get('message', message['error'])}")
                if kind[0] == "attach":
                    attached.discard(kind[1])
            elif kind[0] == "attach":
                session_id = message.get("result", {}).get("sessionId")
                if session_id:
                    inject(session_id, kind[2])
            elif kind[0] == "eval":
                details = (message.get("result") or {}).get("exceptionDetails")
                if details:
                    text = details.get("text") or details.get("exception", {}).get("description") or "failed"
                    log(f"keyboard script error: {text}")
            continue

        method = message.get("method")
        params = message.get("params") or {}
        if method == "Target.targetCreated":
            consider(params.get("target"), send, attached)
        elif method == "Target.targetInfoChanged":
            consider(params.get("targetInfo"), send, attached)
        elif method == "Target.targetDestroyed":
            attached.discard(params.get("targetId"))
        elif method == "Target.attachedToTarget":
            session_id = params.get("sessionId")
            info = params.get("targetInfo") or {}
            if session_id:
                inject(session_id, info.get("url") or "")


def consider(info, send, attached):
    if not interesting(info):
        return
    target_id = info.get("targetId")
    if not target_id or target_id in attached:
        return
    attached.add(target_id)
    send(
        "Target.attachToTarget",
        {"targetId": target_id, "flatten": True},
        kind=("attach", target_id, info.get("url") or ""),
    )


def acquire_lock():
    import fcntl
    handle = open("/tmp/homeboard-oauth-assist.lock", "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit(0)
    return handle


def serve_forever():
    acquire_lock()
    while True:
        try:
            run_session()
        except Exception as error:
            log(f"waiting for browser: {error}")
            time.sleep(1)


def self_test():
    """Speak a tiny DevTools session and confirm the keyboard script is installed."""
    import threading

    source_marker = "hb-oauth-cancel"
    received = []
    ready = threading.Event()

    def read_http(conn):
        data = b""
        while b"\r\n\r\n" not in data:
            data += conn.recv(4096)
        return data.split(b"\r\n\r\n", 1)[0].decode()

    def read_frame(conn):
        header = read_exact(conn, 2)
        length = header[1] & 0x7F
        if length == 126:
            length = int.from_bytes(read_exact(conn, 2), "big")
        elif length == 127:
            length = int.from_bytes(read_exact(conn, 8), "big")
        mask = read_exact(conn, 4)
        payload = read_exact(conn, length)
        return bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

    def send_frame(conn, text):
        payload = text.encode()
        header = bytearray([0x81, len(payload)])
        conn.sendall(header + payload)

    def handle(conn, port):
        request = read_http(conn)
        if request.startswith("GET /json/version"):
            body = json.dumps({
                "Browser": "test",
                "webSocketDebuggerUrl": f"ws://127.0.0.1:{port}/devtools/browser/test",
            }).encode()
            conn.sendall(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                + str(len(body)).encode()
                + b"\r\nConnection: close\r\n\r\n"
                + body
            )
            conn.close()
            return
        key = request.split("Sec-WebSocket-Key: ", 1)[1].split("\r\n", 1)[0].strip()
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        conn.sendall(
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n".encode()
        )
        first = json.loads(read_frame(conn))
        received.append(first["method"])
        send_frame(conn, json.dumps({
            "method": "Target.targetCreated",
            "params": {"target": {
                "targetId": "page1",
                "type": "page",
                "url": "http://127.0.0.1/",
            }},
        }))
        attach = json.loads(read_frame(conn))
        received.append(attach["method"])
        send_frame(conn, json.dumps({
            "id": attach["id"],
            "result": {"sessionId": "sess1"},
        }))
        script = json.loads(read_frame(conn))
        received.append(script["method"])
        if source_marker not in script["params"]["source"]:
            raise SystemExit("keyboard script was not installed")
        send_frame(conn, json.dumps({"id": script["id"], "result": {"identifier": "1"}}))
        evaluate = json.loads(read_frame(conn))
        received.append(evaluate["method"])
        ready.set()
        conn.close()

    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    port = server.getsockname()[1]
    server.listen()

    def accept_loop():
        while not ready.is_set():
            server.settimeout(5)
            try:
                conn, _ = server.accept()
            except socket.timeout:
                return
            handle(conn, port)

    thread = threading.Thread(target=accept_loop)
    thread.start()
    try:
        run_session("127.0.0.1", port)
    except ConnectionError:
        pass
    thread.join(timeout=5)
    server.close()
    if not ready.is_set():
        raise SystemExit(f"debugger session did not install the keyboard: {received}")
    print("self-test ok")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        serve_forever()
