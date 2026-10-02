#!/bin/bash
# Start Kokoro TTS on this workstation (localhost:8880).
# The Pi reaches it the same way it reaches Ollama: Windows portproxy + LAN firewall.
set -euo pipefail

DIR="${HOMEBOARD_TTS_DIR:-$HOME/.local/share/homeboard-tts}"
VENV="$DIR/venv"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/deploy/homeboard-tts.py"
HOST="${HOMEBOARD_TTS_HOST:-127.0.0.1}"
PORT="${HOMEBOARD_TTS_PORT:-8880}"
LAN_IP="${HOMEBOARD_TTS_LAN_IP:-192.168.4.81}"

mkdir -p "$DIR"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q -U pip
"$VENV/bin/pip" install -q 'kokoro-onnx>=0.4.9' numpy

UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/homeboard-tts.service" << EOF
[Unit]
Description=HomeBoard Kokoro TTS
After=network.target

[Service]
Type=simple
ExecStart=$VENV/bin/python $SCRIPT
Restart=on-failure
RestartSec=3
Environment=HOMEBOARD_TTS_HOST=$HOST
Environment=HOMEBOARD_TTS_PORT=$PORT
Environment=HOMEBOARD_TTS_DIR=$DIR
Environment=HOMEBOARD_TTS_VOICE=${HOMEBOARD_TTS_VOICE:-af_heart}

[Install]
WantedBy=default.target
EOF

if command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user enable --now homeboard-tts.service
else
  if ! pgrep -f "$SCRIPT" >/dev/null; then
    nohup "$VENV/bin/python" "$SCRIPT" >>"$DIR/tts.log" 2>&1 &
  fi
fi

echo "Kokoro TTS listening on http://$HOST:$PORT"
echo
echo "If the Pi cannot reach it, run these in an elevated Windows PowerShell:"
echo "  netsh interface portproxy add v4tov4 listenaddress=$LAN_IP listenport=$PORT connectaddress=127.0.0.1 connectport=$PORT"
echo "  New-NetFirewallRule -DisplayName 'HomeBoard Kokoro LAN' -Direction Inbound -Protocol TCP -LocalPort $PORT -RemoteAddress 192.168.4.0/24 -Action Allow -Profile Any"
