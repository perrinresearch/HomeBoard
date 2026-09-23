#!/bin/bash
# Runs on the Pi as root, after push-build.sh has uploaded files to /tmp.
set -euo pipefail

rsync -a --delete /tmp/homeboard-build/ /var/www/homeboard/
chown -R www-data:www-data /var/www/homeboard
mkdir -p /var/lib/homeboard /etc/homeboard /usr/local/lib/homeboard
if [ ! -f /etc/homeboard/calendar.env ]; then
  cp /tmp/homeboard-broker/calendar.env.example /etc/homeboard/calendar.env
  chmod 600 /etc/homeboard/calendar.env
fi
install -m 755 /tmp/homeboard-broker/homeboard-calendar.py /usr/local/lib/homeboard/homeboard-calendar.py
install -m 644 /tmp/homeboard-broker/firestore_push.py /usr/local/lib/homeboard/firestore_push.py
install -o root -g root -m 755 /tmp/homeboard-broker/set-timezone /usr/local/lib/homeboard/set-timezone
install -o root -g root -m 440 /tmp/homeboard-broker/homeboard-timezone.sudoers /etc/sudoers.d/homeboard-timezone
if ! visudo -cf /etc/sudoers.d/homeboard-timezone; then
  rm -f /etc/sudoers.d/homeboard-timezone
  echo "timezone sudoers file was rejected" >&2
  exit 1
fi
install -o root -g root -m 755 /tmp/homeboard-broker/wifi-helper /usr/local/lib/homeboard/wifi-helper
install -o root -g root -m 440 /tmp/homeboard-broker/homeboard-wifi.sudoers /etc/sudoers.d/homeboard-wifi
if ! visudo -cf /etc/sudoers.d/homeboard-wifi; then
  rm -f /etc/sudoers.d/homeboard-wifi
  echo "wifi sudoers file was rejected" >&2
  exit 1
fi
install -m 644 /tmp/homeboard-broker/homeboard-calendar.service /etc/systemd/system/homeboard-calendar.service
install -m 644 /tmp/homeboard-broker/nginx-homeboard.conf /etc/nginx/sites-available/homeboard
chown -R www-data:www-data /var/lib/homeboard
# Restart the broker before optional package installs so Settings is not left
# talking to an old process if apt-get later fails.
systemctl daemon-reload
systemctl enable homeboard-calendar
systemctl restart homeboard-calendar
DEBIAN_FRONTEND=noninteractive apt-get install -y python3-icalendar python3-cryptography python3-tk matchbox-keyboard iw || true
install -m 755 /tmp/homeboard-broker/homeboard-oauth-assist.py /usr/local/bin/homeboard-oauth-assist.py
mkdir -p /usr/local/share/homeboard/oauth-keyboard
cp -a /tmp/homeboard-broker/oauth-keyboard/. /usr/local/share/homeboard/oauth-keyboard/
chmod -R a+rX /usr/local/share/homeboard/oauth-keyboard
python3 - << 'PY'
from pathlib import Path
path = Path("/usr/local/bin/homeboard-kiosk.sh")
text = path.read_text().replace("\r\n", "\n").replace("\r", "\n")
changed = False
if "remote-debugging-port=9222" not in text:
    text = text.replace(
        "--overscroll-history-navigation=0 \\\n",
        "--overscroll-history-navigation=0 \\\n"
        "    --remote-debugging-port=9222 \\\n"
        "    --remote-debugging-address=127.0.0.1 \\\n"
        "    --remote-allow-origins=* \\\n",
        1,
    )
    changed = True
if "oauth-keyboard" not in text:
    import re
    url_line = re.search(r'(?m)^[ \t]*["\']?\$URL["\']?[ \t]*$', text)
    if not url_line:
        raise SystemExit('kiosk script has no "$URL" browser launch line')
    extension_lines = (
        "    --load-extension=/usr/local/share/homeboard/oauth-keyboard \\\n"
        "    --disable-extensions-except=/usr/local/share/homeboard/oauth-keyboard \\\n"
    )
    text = text[:url_line.start()] + extension_lines + text[url_line.start():]

    def add_switch(match):
        features = match.group(1)
        if "DisableLoadExtensionCommandLineSwitch" in features:
            return match.group(0)
        return "--disable-features=" + features + ",DisableLoadExtensionCommandLineSwitch"

    text, count = re.subn(r"--disable-features=([^\s\\]+)", add_switch, text, count=1)
    if count == 0:
        text = text.replace(
            extension_lines,
            "    --disable-features=DisableLoadExtensionCommandLineSwitch \\\n" + extension_lines,
            1,
        )
    changed = True
if "homeboard-oauth-assist.py" not in text:
    text = text.replace(
        'mkdir -p "$PROFILE"\n',
        'mkdir -p "$PROFILE"\n\n'
        'if [ -f /usr/local/bin/homeboard-oauth-assist.py ]; then\n'
        '  python3 /usr/local/bin/homeboard-oauth-assist.py >/tmp/homeboard-oauth-assist.log 2>&1 &\n'
        'fi\n',
        1,
    )
    changed = True
if "pgrep -f /usr/local/bin/homeboard-oauth-assist.py" not in text:
    old = "while true; do\n"
    new = (
        "while true; do\n"
        "  if [ -f /usr/local/bin/homeboard-oauth-assist.py ] && ! pgrep -f /usr/local/bin/homeboard-oauth-assist.py >/dev/null; then\n"
        "    python3 /usr/local/bin/homeboard-oauth-assist.py >/tmp/homeboard-oauth-assist.log 2>&1 &\n"
        "  fi\n"
    )
    if old in text:
        text = text.replace(old, new, 1)
        changed = True
if changed:
    path.write_text(text)
    Path("/tmp/homeboard-restart-kiosk").write_text("1\n")
PY
systemctl daemon-reload
systemctl enable homeboard-calendar
systemctl restart homeboard-calendar
nginx -t
systemctl reload nginx
# The sign-in helper has to be the process started from the file just installed.
pkill -f /usr/local/bin/homeboard-oauth-assist.py || true
if [ -f /tmp/homeboard-restart-kiosk ]; then
  rm -f /tmp/homeboard-restart-kiosk
  systemctl restart lightdm || true
else
  touch /tmp/homeboard-oauth-assist.log
  chown homeboard:homeboard /tmp/homeboard-oauth-assist.log || true
  sudo -u homeboard python3 /usr/local/bin/homeboard-oauth-assist.py >/tmp/homeboard-oauth-assist.log 2>&1 &
  pkill -u homeboard chromium || true
fi
echo published
