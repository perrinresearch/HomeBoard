#!/usr/bin/env python3
"""Capture the Flex mic with ALSA and stream Vosk transcripts to the kiosk page."""
from __future__ import annotations

import array
import json
import math
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty, Full, Queue
from typing import List

from vosk import KaldiRecognizer, Model

HOST = os.environ.get("HOMEBOARD_VOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("HOMEBOARD_VOICE_PORT", "8791"))
MODEL_PATH = os.environ.get(
    "HOMEBOARD_VOSK_MODEL",
    "/usr/local/share/homeboard/vosk-model-small-en-us-0.15",
)
RATE = 16000
CHUNK = 8000
DEVICES = [
    "plughw:CARD=L48K2Ch,DEV=0",
    os.environ.get("HOMEBOARD_MIC", "homeboard_mic"),
    "plughw:1,0",
]

clients: List[Queue] = []
lock = threading.Lock()
speak_lock = threading.Lock()
speak_proc: subprocess.Popen | None = None
SPEAK_WAV = Path("/tmp/homeboard-speak.wav")
PIPER_BIN = Path(os.environ.get("HOMEBOARD_PIPER", "/usr/local/lib/homeboard/piper/piper"))
PIPER_MODEL = Path(
    os.environ.get("HOMEBOARD_PIPER_MODEL", "/usr/local/share/homeboard/piper/en_US-lessac-medium.onnx")
)
TTS_PORT = int(os.environ.get("HOMEBOARD_TTS_PORT", "8880"))
TTS_VOICE = os.environ.get("HOMEBOARD_TTS_VOICE", "af_heart")


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def normalize_http_url(raw: str) -> str:
    url = (raw or "").strip().rstrip("/")
    if url and not url.startswith(("http://", "https://")):
        url = f"http://{url}"
    return url


def workstation_tts_url(config: dict | None = None) -> str:
    data = config if isinstance(config, dict) else load_config()
    explicit = str(data.get("ttsUrl") or os.environ.get("HOMEBOARD_TTS_URL") or "").strip()
    if explicit:
        return normalize_http_url(explicit)
    ollama = str(data.get("ollamaUrl") or "").strip()
    if not ollama:
        return ""
    parsed = urllib.parse.urlparse(normalize_http_url(ollama))
    if not parsed.hostname:
        return ""
    return f"{parsed.scheme}://{parsed.hostname}:{TTS_PORT}"


def stop_playback() -> None:
    global speak_proc
    if speak_proc and speak_proc.poll() is None:
        speak_proc.kill()
        try:
            speak_proc.wait(timeout=1)
        except Exception:
            pass
        speak_proc = None


def wav_looks_ok(path: Path) -> bool:
    try:
        data = path.read_bytes()[:12]
    except OSError:
        return False
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"


def synth_kokoro(text: str) -> bool:
    url = workstation_tts_url()
    if not url:
        return False
    payload = json.dumps(
        {
            "model": "kokoro",
            "input": text,
            "voice": TTS_VOICE,
            "response_format": "wav",
        }
    ).encode()
    request = urllib.request.Request(
        f"{url}/v1/audio/speech",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = response.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as error:
        log(f"kokoro tts failed: {error}")
        return False
    if len(data) < 44 or data[:4] != b"RIFF":
        log("kokoro tts returned empty audio")
        return False
    try:
        SPEAK_WAV.write_bytes(data)
    except OSError as error:
        log(f"kokoro tts write failed: {error}")
        return False
    log("spoke with kokoro")
    return True


def synth_piper(text: str) -> bool:
    piper = PIPER_BIN if PIPER_BIN.is_file() else Path(shutil.which("piper") or "")
    if not piper.is_file() or not PIPER_MODEL.is_file():
        return False
    env = os.environ.copy()
    lib_dir = str(piper.parent)
    env["LD_LIBRARY_PATH"] = lib_dir + (":" + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else "")
    try:
        subprocess.run(
            [str(piper), "--model", str(PIPER_MODEL), "--output_file", str(SPEAK_WAV)],
            input=text.encode(),
            check=True,
            timeout=30,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError) as error:
        log(f"piper failed: {error}")
        return False
    if not wav_looks_ok(SPEAK_WAV):
        log("piper returned empty audio")
        return False
    log("spoke with piper")
    return True


def synth_espeak(text: str) -> bool:
    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if not espeak:
        return False
    try:
        subprocess.run(
            [espeak, "-s", "155", "-v", "en-us", "-w", str(SPEAK_WAV), text],
            check=True,
            timeout=20,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError) as error:
        log(f"espeak failed: {error}")
        return False
    return wav_looks_ok(SPEAK_WAV)


def play_wav() -> None:
    global speak_proc
    for cmd in (
        ["aplay", "-q", str(SPEAK_WAV)],
        ["aplay", "-q", "-D", "homeboard_usb_dmix", str(SPEAK_WAV)],
        ["aplay", "-q", "-D", "plughw:CARD=Device,DEV=0", str(SPEAK_WAV)],
    ):
        try:
            speak_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except OSError:
            continue
    log("aplay failed")


def speak_text(text: str) -> None:
    """Play a short phrase on the USB speaker. Does not use the browser."""
    spoken = " ".join((text or "").split())[:400]
    if not spoken:
        return
    with speak_lock:
        stop_playback()
        if synth_kokoro(spoken) or synth_piper(spoken) or synth_espeak(spoken):
            play_wav()
            return
        log("no tts engine produced audio")


def speak_async(text: str) -> None:
    threading.Thread(target=speak_text, args=(text,), daemon=True).start()


def broadcast(payload: dict) -> None:
    line = json.dumps(payload)
    with lock:
        targets = list(clients)
    for queue in targets:
        try:
            queue.put_nowait(line)
        except Full:
            pass


def pcm_level(data: bytes) -> float:
    samples = array.array("h")
    samples.frombytes(data[: len(data) - (len(data) % 2)])
    if not samples:
        return 0.0
    acc = 0
    for sample in samples:
        acc += sample * sample
    return min(1.0, math.sqrt(acc / len(samples)) / 5000.0)


def open_capture():
    for device in DEVICES:
        cmd = [
            "arecord",
            "-q",
            "-D",
            device,
            "-f",
            "S16_LE",
            "-c",
            "1",
            "-r",
            str(RATE),
            "-t",
            "raw",
        ]
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                bufsize=0,
            )
        except FileNotFoundError:
            log("arecord is not installed")
            return None, None
        time.sleep(0.3)
        if proc.poll() is None and proc.stdout:
            log(f"capture opened on {device}")
            return proc, device
        log(f"capture failed on {device} (exit {proc.returncode})")
        proc.kill()
    return None, None


def capture_loop(model: Model) -> None:
    rec = KaldiRecognizer(model, RATE)
    while True:
        proc, device = open_capture()
        if not proc or not proc.stdout:
            time.sleep(2)
            continue
        chunks: Queue = Queue(maxsize=4)
        stop = threading.Event()
        dropped = threading.Event()
        last_level = -1.0
        last_level_at = 0.0

        def reader() -> None:
            nonlocal last_level, last_level_at
            try:
                while not stop.is_set():
                    data = proc.stdout.read(CHUNK)
                    if not data:
                        break
                    level = pcm_level(data)
                    now = time.monotonic()
                    if now - last_level_at >= 0.08 or abs(level - last_level) >= 0.04:
                        last_level = level
                        last_level_at = now
                        broadcast({"level": round(level, 3)})
                    if chunks.full():
                        try:
                            chunks.get_nowait()
                        except Empty:
                            pass
                        dropped.set()
                    try:
                        chunks.put_nowait(data)
                    except Full:
                        dropped.set()
            finally:
                try:
                    chunks.put_nowait(b"")
                except Full:
                    pass

        thread = threading.Thread(target=reader, daemon=True)
        thread.start()
        try:
            while True:
                data = chunks.get()
                if not data:
                    break
                if dropped.is_set():
                    rec.Reset()
                    dropped.clear()
                if rec.AcceptWaveform(data):
                    text = json.loads(rec.Result()).get("text", "").strip()
                    if text:
                        broadcast({"text": text, "final": True})
                else:
                    partial = json.loads(rec.PartialResult()).get("partial", "").strip()
                    if partial:
                        broadcast({"text": partial, "final": False})
        finally:
            stop.set()
            proc.kill()
            try:
                proc.wait(timeout=2)
            except Exception:
                pass
            leftover = json.loads(rec.FinalResult()).get("text", "").strip()
            if leftover:
                broadcast({"text": leftover, "final": True})
            rec = KaldiRecognizer(model, RATE)
            log(f"capture ended on {device}, retrying")
            time.sleep(1)


CONFIG_PATH = Path(os.environ.get("HOMEBOARD_VOICE_CONFIG", "/var/lib/homeboard/voice.json"))
DEFAULT_CONFIG = {
    "mode": "off",
    "ollamaUrl": "",
    "ollamaModel": "llama3.2",
    "cloudModel": "gpt-4.1-mini",
    "ttsUrl": "",
}
SYSTEM = """You convert household speech into one JSON object for a family wall board.
Allowed kinds: timer, reminder, stop, shop, none.
Always set reply to one short spoken sentence. The board reads reply aloud.
- timer: a countdown from now. Set minutes and label. reply confirms it.
- reminder: a clock time today or tomorrow. Set hour, minute, meridiem (am, pm, or empty), and label. reply confirms it.
- stop: silence the alarm. reply can be empty or a short confirmation.
- shop: add one item to the shopping list. Put the item name in label. reply confirms it.
- none: questions, chat, or anything you cannot do. Do not create a timer or reminder. Put the spoken answer in reply.
Never change Wi-Fi, timezone, passwords, or calendar account tokens. Those are none.
Do not turn shopping, chores, or questions into reminders. If they ask to buy or add something, use shop.
If they ask a question, use none and answer in reply from the board data when it is present.
Return only JSON with keys: kind, label, minutes, hour, minute, meridiem, reply."""


def load_config() -> dict:
    data = dict(DEFAULT_CONFIG)
    try:
        loaded = json.loads(CONFIG_PATH.read_text())
        if isinstance(loaded, dict):
            data.update(loaded)
    except (OSError, json.JSONDecodeError):
        pass
    mode = str(data.get("mode") or "off").strip().lower()
    data["mode"] = mode if mode in ("off", "workstation", "cloud") else "off"
    data["ollamaUrl"] = str(data.get("ollamaUrl") or "").strip().rstrip("/")
    data["ollamaModel"] = str(data.get("ollamaModel") or "llama3.2").strip() or "llama3.2"
    data["cloudModel"] = str(data.get("cloudModel") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    data["ttsUrl"] = str(data.get("ttsUrl") or "").strip().rstrip("/")
    return data


def public_config() -> dict:
    config = load_config()
    return {
        "mode": config["mode"],
        "ollamaUrl": config["ollamaUrl"],
        "ollamaModel": config["ollamaModel"],
        "cloudReady": bool(os.environ.get("VOICE_CLOUD_KEY", "").strip()),
    }


def save_config(body: dict) -> dict:
    config = load_config()
    if "mode" in body:
        mode = str(body.get("mode") or "").strip().lower()
        if mode in ("off", "workstation", "cloud"):
            config["mode"] = mode
    if "ollamaUrl" in body:
        url = str(body.get("ollamaUrl") or "").strip().rstrip("/")
        if url and not url.startswith(("http://", "https://")):
            url = f"http://{url}"
        config["ollamaUrl"] = url
    if "ollamaModel" in body:
        config["ollamaModel"] = str(body.get("ollamaModel") or "llama3.2").strip() or "llama3.2"
    if "ttsUrl" in body:
        url = str(body.get("ttsUrl") or "").strip().rstrip("/")
        if url and not url.startswith(("http://", "https://")):
            url = f"http://{url}"
        config["ttsUrl"] = url
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2) + "\n")
    return public_config()


def normalize_ollama_url(raw: str) -> str:
    return normalize_http_url(raw)


def http_get_json(url: str, timeout: int = 8) -> dict:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        return json.loads(raw.decode() or "{}") if raw else {}


def list_ollama_models(url: str) -> list[str]:
    base = normalize_ollama_url(url) or load_config()["ollamaUrl"]
    if not base:
        raise RuntimeError("Set the workstation address first")
    body = http_get_json(f"{base}/api/tags")
    names: list[str] = []
    seen = set()
    for item in body.get("models") or []:
        name = str((item or {}).get("name") or (item or {}).get("model") or "").strip()
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    names.sort(key=str.lower)
    return names


def http_json(url: str, payload: dict, headers: dict, timeout: int = 60) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        return json.loads(raw.decode() or "{}") if raw else {}


def empty_intent() -> dict:
    return {"kind": "none", "label": "", "minutes": 0, "hour": 0, "minute": 0, "meridiem": "", "reply": ""}


def parse_intent(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return empty_intent()
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return empty_intent()
    if not isinstance(data, dict):
        return empty_intent()
    intent = empty_intent()
    intent.update({key: data[key] for key in intent if key in data})
    kind = str(intent.get("kind") or "none").strip().lower()
    if kind in ("answer", "talk", "say"):
        kind = "none"
    intent["kind"] = kind if kind in ("timer", "reminder", "stop", "shop", "none") else "none"
    reply = str(intent.get("reply") or "").strip()
    if len(reply) > 240:
        reply = reply[:237].rsplit(" ", 1)[0] + "."
    intent["reply"] = reply
    return intent


def interpret_workstation(text: str, config: dict) -> dict:
    url = config["ollamaUrl"]
    if not url:
        return empty_intent()
    payload = {
        "model": config["ollamaModel"],
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": text},
        ],
    }
    body = http_json(f"{url}/api/chat", payload, {})
    return parse_intent(((body.get("message") or {}).get("content")) or "")


def interpret_cloud(text: str, config: dict) -> dict:
    key = os.environ.get("VOICE_CLOUD_KEY", "").strip()
    base = os.environ.get("VOICE_CLOUD_URL", "https://api.openai.com/v1").strip().rstrip("/")
    if not key:
        return empty_intent()
    payload = {
        "model": config["cloudModel"],
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": text},
        ],
    }
    body = http_json(
        f"{base}/chat/completions",
        payload,
        {"Authorization": f"Bearer {key}"},
    )
    content = (((body.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    return parse_intent(content)


def interpret(text: str, context: str = "") -> dict:
    spoken = (text or "").strip()
    if not spoken:
        return empty_intent()
    config = load_config()
    mode = config["mode"]
    if mode == "off":
        return empty_intent()
    if mode == "cloud" and not os.environ.get("VOICE_CLOUD_KEY", "").strip():
        intent = empty_intent()
        intent["reply"] = "Cloud voice is not set up yet."
        return intent
    if mode == "workstation" and not config["ollamaUrl"]:
        intent = empty_intent()
        intent["reply"] = "Set the workstation address in Settings."
        return intent
    prompt = spoken
    extra = (context or "").strip()
    if extra:
        prompt = f"{extra}\n\nHeard: {spoken}"
    try:
        if mode == "cloud":
            return interpret_cloud(prompt, config)
        return interpret_workstation(prompt, config)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError) as error:
        log(f"interpret failed: {error}")
        intent = empty_intent()
        intent["reply"] = "I could not reach the language model."
        return intent


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(min(length, 100_000))
        try:
            data = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def route_path(self) -> str:
        return self.path.split("?", 1)[0].rstrip("/") or "/"

    def do_GET(self) -> None:
        path = self.route_path()
        if path.endswith("health") or path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if path.endswith("config") or path == "/config":
            self.send_json(public_config())
            return
        if path.endswith("models") or path == "/models":
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            url = (query.get("url") or [""])[0]
            try:
                self.send_json({"models": list_ollama_models(url)})
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError, RuntimeError) as error:
                self.send_json({"error": str(error) or "Could not load models", "models": []}, 400)
            return

        queue: Queue = Queue(maxsize=64)
        with lock:
            clients.append(queue)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            while True:
                try:
                    message = queue.get(timeout=15)
                    self.wfile.write(f"data: {message}\n\n".encode())
                    self.wfile.flush()
                except Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, TimeoutError, OSError):
            pass
        finally:
            with lock:
                if queue in clients:
                    clients.remove(queue)

    def do_POST(self) -> None:
        path = self.route_path()
        body = self.read_json()
        if path.endswith("interpret") or path == "/interpret":
            self.send_json(interpret(str(body.get("text") or ""), str(body.get("context") or "")))
            return
        if path.endswith("speak") or path == "/speak":
            speak_async(str(body.get("text") or body.get("reply") or ""))
            self.send_json({"ok": True})
            return
        if path.endswith("config") or path == "/config":
            self.send_json(save_config(body))
            return
        self.send_json({"error": "Not found"}, 404)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> int:
    if not os.path.isdir(MODEL_PATH):
        log(f"missing vosk model at {MODEL_PATH}")
        return 1
    log(f"loading vosk model {MODEL_PATH}")
    model = Model(MODEL_PATH)
    threading.Thread(target=capture_loop, args=(model,), daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"voice transcripts on http://{HOST}:{PORT}/")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
