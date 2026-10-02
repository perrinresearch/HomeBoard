#!/usr/bin/env python3
"""Kokoro TTS for HomeBoard. Bind to localhost; Windows portproxy exposes it on LAN."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

HOST = os.environ.get("HOMEBOARD_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("HOMEBOARD_TTS_PORT", "8880"))
VOICE = os.environ.get("HOMEBOARD_TTS_VOICE", "af_heart")
MODEL_DIR = Path(os.environ.get("HOMEBOARD_TTS_DIR", Path.home() / ".local/share/homeboard-tts"))
MODEL_ONNX = Path(os.environ.get("HOMEBOARD_TTS_MODEL", str(MODEL_DIR / "kokoro-v1.0.onnx")))
VOICES_BIN = Path(os.environ.get("HOMEBOARD_TTS_VOICES", str(MODEL_DIR / "voices-v1.0.bin")))
MODEL_URL = os.environ.get(
    "HOMEBOARD_TTS_MODEL_URL",
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
)
VOICES_URL = os.environ.get(
    "HOMEBOARD_TTS_VOICES_URL",
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
)

engine: Kokoro | None = None


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 1_000_000:
        return
    tmp = dest.with_suffix(dest.suffix + ".part")
    log(f"downloading {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "homeboard-tts"})
    with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    tmp.replace(dest)


def write_wav(samples, rate: int) -> bytes:
    audio = np.asarray(samples)
    if audio.ndim > 1:
        audio = audio.reshape(-1)
    if audio.dtype != np.int16:
        audio = np.clip(audio.astype(np.float32), -1.0, 1.0)
        audio = (audio * 32767.0).astype(np.int16)
    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(int(rate))
        wav.writeframes(audio.tobytes())
    return buffer.getvalue()


def synthesize(text: str, voice: str) -> bytes:
    spoken = " ".join((text or "").split())[:400]
    if not spoken:
        raise ValueError("empty text")
    if engine is None:
        raise RuntimeError("tts is not ready")
    chosen = (voice or VOICE).strip() or VOICE
    samples, rate = engine.create(spoken, voice=chosen, speed=1.0, lang="en-us")
    return write_wav(samples, rate)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_bytes(self, payload: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, payload: dict, status: int = 200) -> None:
        self.send_bytes(json.dumps(payload).encode(), "application/json", status)

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
        if path in ("/health", "/v1/health"):
            voices = []
            try:
                if engine is not None:
                    voices = list(engine.get_voices())
            except Exception:
                voices = []
            self.send_json({"ok": True, "engine": "kokoro", "voice": VOICE, "voices": voices})
            return
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        path = self.route_path()
        if path not in ("/v1/audio/speech", "/speak"):
            self.send_json({"error": "Not found"}, 404)
            return
        body = self.read_json()
        text = str(body.get("input") or body.get("text") or "")
        voice = str(body.get("voice") or VOICE)
        try:
            wav = synthesize(text, voice)
        except Exception as error:
            log(f"synth failed: {error}")
            self.send_json({"error": str(error) or "Could not speak"}, 400)
            return
        self.send_bytes(wav, "audio/wav")

    def log_message(self, format: str, *args) -> None:
        return


def main() -> int:
    download(MODEL_URL, MODEL_ONNX)
    download(VOICES_URL, VOICES_BIN)
    log(f"loading kokoro {MODEL_ONNX}")
    global engine
    engine = Kokoro(str(MODEL_ONNX), str(VOICES_BIN))
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"kokoro tts on http://{HOST}:{PORT}/v1/audio/speech")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
