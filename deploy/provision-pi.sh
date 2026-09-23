#!/bin/bash
# Provision an Armbian system as a HomeBoard kiosk.
#
# Run it either way:
#   bash provision-pi.sh          # as a sudo-capable user, over SSH
#   provision-pi.sh               # as root, e.g. from the first-boot service
#
# Works on the Minimal/CLI image (installs the X stack) and on a desktop image
# (X already present). Result: nginx serves the static HomeBoard build on port
# 80, and the Pi boots straight into a fullscreen Chromium showing it. No
# desktop, no panels, no Node runtime on the device.
#
# If /usr/local/share/homeboard/build.tar.gz exists it is unpacked into the web
# root, so a pre-staged card needs no network deploy step.
set -euo pipefail

KIOSK_USER="homeboard"
WEB_ROOT="/var/www/homeboard"
URL="http://127.0.0.1/"
BAKED_BUILD="/usr/local/share/homeboard/build.tar.gz"

# Allow the same script to run as root (first boot) or via sudo (manual).
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "== Installing packages =="
$SUDO apt-get update
# xserver-xorg + libinput are required on Minimal images and harmless on
# desktop ones. dbus-x11 and a base font are needed for Chromium to render on
# an otherwise bare system.
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y --no-install-recommends \
  nginx \
  chromium \
  lightdm \
  xserver-xorg \
  xserver-xorg-input-libinput \
  xinit \
  x11-xserver-utils \
  openbox \
  dbus-x11 \
  fonts-dejavu-core \
  unclutter \
  avahi-daemon \
  curl \
  rsync \
  python3-icalendar \
  python3-tk \
  matchbox-keyboard

# Ubuntu ships chromium as a snap shim, which behaves badly in a kiosk.
CHROMIUM_BIN=""
for candidate in /usr/bin/chromium /usr/bin/chromium-browser; do
  [ -x "$candidate" ] && CHROMIUM_BIN="$candidate" && break
done
if [ -z "$CHROMIUM_BIN" ]; then
  echo "No chromium binary found in /usr/bin. If this is Ubuntu, chromium was" >&2
  echo "probably installed as a snap. Install a real package and re-run." >&2
  exit 1
fi
echo "Using browser: $CHROMIUM_BIN"

echo "== Creating kiosk user '$KIOSK_USER' =="
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  $SUDO adduser --disabled-password --gecos "HomeBoard Kiosk" "$KIOSK_USER"
fi
for group in video input audio render tty; do
  getent group "$group" >/dev/null && $SUDO usermod -aG "$group" "$KIOSK_USER" || true
done

echo "== Web root =="
$SUDO mkdir -p "$WEB_ROOT"
if [ -f "$BAKED_BUILD" ]; then
  echo "Unpacking pre-staged build"
  $SUDO tar -xzf "$BAKED_BUILD" -C "$WEB_ROOT"
elif [ ! -f "$WEB_ROOT/index.html" ]; then
  $SUDO tee "$WEB_ROOT/index.html" >/dev/null << 'EOF'
<!doctype html>
<html><body style="font-family:sans-serif;background:#667eea;color:#fff;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<h1>HomeBoard not deployed yet</h1></body></html>
EOF
fi
$SUDO chown -R www-data:www-data "$WEB_ROOT"

echo "== nginx =="
$SUDO tee /etc/nginx/sites-available/homeboard >/dev/null << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root $WEB_ROOT;
    index index.html;

    # Keep SD card writes low.
    access_log off;

    location /api/ {
        proxy_pass http://127.0.0.1:8787/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /static/ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
EOF
$SUDO ln -sf /etc/nginx/sites-available/homeboard /etc/nginx/sites-enabled/homeboard
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl enable nginx
$SUDO systemctl restart nginx

echo "== Calendar broker =="
HERE="$(cd "$(dirname "$0")" && pwd)"
$SUDO mkdir -p /var/lib/homeboard /etc/homeboard /usr/local/lib/homeboard
if [ ! -f /etc/homeboard/calendar.env ]; then
  $SUDO cp "$HERE/calendar-broker/calendar.env.example" /etc/homeboard/calendar.env 2>/dev/null || \
    $SUDO touch /etc/homeboard/calendar.env
  $SUDO chmod 600 /etc/homeboard/calendar.env
fi
if [ -f "$HERE/calendar-broker/homeboard-calendar.py" ]; then
  $SUDO cp "$HERE/calendar-broker/homeboard-calendar.py" /usr/local/lib/homeboard/homeboard-calendar.py
  $SUDO cp "$HERE/calendar-broker/homeboard-calendar.service" /etc/systemd/system/homeboard-calendar.service
  $SUDO chmod 755 /usr/local/lib/homeboard/homeboard-calendar.py
  if [ -f "$HERE/calendar-broker/set-timezone" ]; then
    $SUDO install -o root -g root -m 755 "$HERE/calendar-broker/set-timezone" /usr/local/lib/homeboard/set-timezone
    $SUDO install -o root -g root -m 440 "$HERE/calendar-broker/homeboard-timezone.sudoers" /etc/sudoers.d/homeboard-timezone
    if ! $SUDO visudo -cf /etc/sudoers.d/homeboard-timezone; then
      $SUDO rm -f /etc/sudoers.d/homeboard-timezone
      echo "timezone sudoers file was rejected" >&2
      exit 1
    fi
  fi
  $SUDO chown -R www-data:www-data /var/lib/homeboard
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable homeboard-calendar
  $SUDO systemctl restart homeboard-calendar || true
fi

echo "== Kiosk launcher =="
$SUDO tee /usr/local/bin/homeboard-kiosk.sh >/dev/null << EOF
#!/bin/bash
# Launched as the X session for the kiosk user. Runs until the Pi powers off.
URL="\${HOMEBOARD_URL:-$URL}"
BROWSER="$CHROMIUM_BIN"
EOF
$SUDO tee -a /usr/local/bin/homeboard-kiosk.sh >/dev/null << 'EOF'
PROFILE="$HOME/.homeboard-chrome"

# No blanking, no screensaver, no visible cursor on a touchscreen.
xset s off || true
xset -dpms || true
xset s noblank || true
unclutter -idle 0 -root &

# A bare X session ignores Chromium's fullscreen request, so the window opens
# at its default size in the top-left and the rest of the panel stays empty.
# Openbox is what actually honors --kiosk.
if ! pgrep -x openbox >/dev/null; then
  openbox >/dev/null 2>&1 &
  sleep 0.5
fi

# Use the panel's preferred mode when it differs from the active one. Cheap
# HDMI touch panels are often driven at 1920x1080 and only show the left half.
OUT=$(xrandr | awk '/ connected/{print $1; exit}')
PREF=$(xrandr | awk -v out="$OUT" '$1==out {p=1; next} p && /\+/ {print $1; exit}')
if [ -n "$OUT" ] && [ -n "$PREF" ]; then
  xrandr --output "$OUT" --mode "$PREF" || true
fi

# Touch coordinates follow the output. Without this, taps land on the blank
# half of a mis-sized framebuffer and the screen feels dead.
if [ -n "$OUT" ]; then
  xinput list | awk -F'id=' '/slave[[:space:]]+pointer/ && $0 !~ /Virtual/ {split($2,a," "); print a[1]}' \
    | while read -r id; do
        xinput map-to-output "$id" "$OUT" || true
      done
fi

GEOM=$(xrandr | awk '/ connected/{for (i=1;i<=NF;i++) if ($i ~ /^[0-9]+x[0-9]+\+/) {split($i,a,"+"); print a[1]; exit}}')
WIN_W=${GEOM%x*}
WIN_H=${GEOM#*x}

# Wait for nginx before showing anything.
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "$URL" && break
  sleep 1
done

mkdir -p "$PROFILE"

while true; do
  # Chromium ignores --load-extension, so the sign-in keyboard is injected
  # through the local DevTools port. Restart the helper if it has exited.
  if [ -f /usr/local/bin/homeboard-oauth-assist.py ] && ! pgrep -f /usr/local/bin/homeboard-oauth-assist.py >/dev/null; then
    python3 /usr/local/bin/homeboard-oauth-assist.py >/tmp/homeboard-oauth-assist.log 2>&1 &
  fi

  # Suppress the "Chromium didn't shut down correctly" restore bar after a
  # power cut, which would otherwise sit on top of the dashboard.
  PREFS="$PROFILE/Default/Preferences"
  if [ -f "$PREFS" ]; then
    sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' "$PREFS" || true
  fi

  "$BROWSER" \
    --kiosk \
    --start-fullscreen \
    --window-position=0,0 \
    --window-size="${WIN_W:-1920},${WIN_H:-1080}" \
    --touch-events=enabled \
    --user-data-dir="$PROFILE" \
    --disk-cache-dir=/tmp/homeboard-cache \
    --disk-cache-size=33554432 \
    --no-first-run \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI,DisableLoadExtensionCommandLineSwitch \
    --load-extension=/usr/local/share/homeboard/oauth-keyboard \
    --disable-extensions-except=/usr/local/share/homeboard/oauth-keyboard \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --check-for-update-interval=31536000 \
    --overscroll-history-navigation=0 \
    --remote-debugging-port=9222 \
    --remote-debugging-address=127.0.0.1 \
    --remote-allow-origins=* \
    "$URL"
  sleep 3
done
EOF
$SUDO chmod 755 /usr/local/bin/homeboard-kiosk.sh
if [ -f "$HERE/homeboard-oauth-assist.py" ]; then
  $SUDO cp "$HERE/homeboard-oauth-assist.py" /usr/local/bin/homeboard-oauth-assist.py
  $SUDO chmod 755 /usr/local/bin/homeboard-oauth-assist.py
fi
if [ -d "$HERE/oauth-keyboard" ]; then
  $SUDO mkdir -p /usr/local/share/homeboard/oauth-keyboard
  $SUDO cp -a "$HERE/oauth-keyboard/." /usr/local/share/homeboard/oauth-keyboard/
fi

echo "== X session entry =="
$SUDO mkdir -p /usr/share/xsessions
$SUDO tee /usr/share/xsessions/homeboard-kiosk.desktop >/dev/null << 'EOF'
[Desktop Entry]
Name=HomeBoard Kiosk
Comment=Fullscreen HomeBoard dashboard
Exec=/usr/local/bin/homeboard-kiosk.sh
Type=Application
DesktopNames=HomeBoard
EOF

echo "== LightDM autologin =="
$SUDO mkdir -p /etc/lightdm/lightdm.conf.d
# 95- sorts after Armbian's own 22-armbian-autologin.conf, so this wins.
$SUDO tee /etc/lightdm/lightdm.conf.d/95-homeboard-kiosk.conf >/dev/null << EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
autologin-session=homeboard-kiosk
user-session=homeboard-kiosk
EOF
$SUDO systemctl enable lightdm
$SUDO systemctl set-default graphical.target

echo "== Reducing SD card writes =="
$SUDO mkdir -p /etc/systemd/journald.conf.d
$SUDO tee /etc/systemd/journald.conf.d/homeboard.conf >/dev/null << 'EOF'
[Journal]
Storage=volatile
RuntimeMaxUse=16M
EOF
$SUDO systemctl restart systemd-journald || true

cat << EOF

Provisioning complete.

  Web root : $WEB_ROOT   (served on port 80)
  Browser  : $CHROMIUM_BIN
  Kiosk    : /usr/local/bin/homeboard-kiosk.sh as user '$KIOSK_USER'
  Profile  : /home/$KIOSK_USER/.homeboard-chrome  (dashboard state lives here)

Reboot to bring up the dashboard fullscreen. To publish a new build later:

  ./deploy/push-build.sh <user>@<pi-address>

EOF
