#!/usr/bin/env python3
"""Capture the Flex mic with ALSA and stream Vosk transcripts to the kiosk page."""
from __future__ import annotations

import array
import json
import math
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


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


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path.endswith("health") or path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
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
