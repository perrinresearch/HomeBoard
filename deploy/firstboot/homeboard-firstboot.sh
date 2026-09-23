#!/bin/bash
# Unattended first-boot setup for a pre-staged HomeBoard card.
#
# Injected into the Armbian image along with a matching systemd unit, so the
# Pi goes from "freshly flashed" to "showing the dashboard" with no keyboard
# and no console login. Reads its settings from /boot/homeboard-firstboot.conf.
#
# Safe to re-run: if it cannot reach the network it exits non-zero and stays
# enabled, so the next boot tries again.
set -uo pipefail

CONF="/boot/homeboard-firstboot.conf"
LOG="/var/log/homeboard-firstboot.log"
PROVISION="/usr/local/lib/homeboard/provision-pi.sh"
STAMP="/var/lib/homeboard-firstboot.done"

exec > >(tee -a "$LOG") 2>&1
echo "=== HomeBoard first boot: $(date -Is) ==="

[ -f "$STAMP" ] && { echo "Already provisioned; nothing to do."; exit 0; }

ADMIN_USER=""
ADMIN_PASSWORD=""
ADMIN_SSH_KEY=""
HOSTNAME_NEW=""
TIMEZONE=""
WIFI_SSID=""
# shellcheck disable=SC1090
[ -f "$CONF" ] && source "$CONF"
# A config written on Windows can leave a trailing CR inside each value.
ADMIN_USER=${ADMIN_USER//$'\r'/}
ADMIN_PASSWORD=${ADMIN_PASSWORD//$'\r'/}
ADMIN_SSH_KEY=${ADMIN_SSH_KEY//$'\r'/}
HOSTNAME_NEW=${HOSTNAME_NEW//$'\r'/}
TIMEZONE=${TIMEZONE//$'\r'/}
WIFI_SSID=${WIFI_SSID//$'\r'/}

echo "-- Hostname / timezone --"
if [ -n "$HOSTNAME_NEW" ]; then
  hostnamectl set-hostname "$HOSTNAME_NEW" || true
  # Keep sudo from complaining about an unresolvable host.
  grep -q "$HOSTNAME_NEW" /etc/hosts || echo "127.0.1.1 $HOSTNAME_NEW" >> /etc/hosts
fi
[ -n "$TIMEZONE" ] && timedatectl set-timezone "$TIMEZONE" || true

echo "-- Admin account --"
if [ -n "$ADMIN_USER" ]; then
  if ! id "$ADMIN_USER" >/dev/null 2>&1; then
    useradd -m -s /bin/bash -G sudo,video,audio,input,tty "$ADMIN_USER"
    echo "created $ADMIN_USER"
  fi
  if [ -n "$ADMIN_PASSWORD" ]; then
    echo "$ADMIN_USER:$ADMIN_PASSWORD" | chpasswd
  fi
  if [ -n "$ADMIN_SSH_KEY" ]; then
    install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
    echo "$ADMIN_SSH_KEY" > "/home/$ADMIN_USER/.ssh/authorized_keys"
    chmod 600 "/home/$ADMIN_USER/.ssh/authorized_keys"
    chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh/authorized_keys"
  fi
fi

# Only lock root once a real admin account exists. Doing it earlier, or after
# useradd failed, leaves the machine with no SSH login at all.
if id "$ADMIN_USER" >/dev/null 2>&1; then
  echo "-- Locking down root SSH --"
  passwd -l root || true
  if [ -d /etc/ssh/sshd_config.d ]; then
    echo "PermitRootLogin no" > /etc/ssh/sshd_config.d/10-homeboard.conf
  else
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  fi
  systemctl reload ssh 2>/dev/null || systemctl restart ssh 2>/dev/null || true
else
  echo "-- Admin user missing; leaving root SSH enabled --"
fi

echo "-- Waiting for network --"
online=0
for i in $(seq 1 60); do
  if getent hosts deb.debian.org >/dev/null 2>&1; then online=1; break; fi
  # If the baked wlan0 name was wrong, retarget netplan at the real interface.
  if [ "$i" -eq 20 ] && [ -n "$WIFI_SSID" ]; then
    real=$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2; exit}')
    if [ -n "$real" ] && [ "$real" != "wlan0" ]; then
      echo "wifi interface is $real, not wlan0; rewriting netplan"
      sed -i "s/^    wlan0:/    $real:/" /etc/netplan/30-wifis-dhcp.yaml
      netplan apply || true
    fi
  fi
  sleep 5
done

if [ "$online" -ne 1 ]; then
  echo "No network after ~5 minutes. Leaving this service enabled to retry on"
  echo "next boot. Check: nmcli/iw dev, /etc/netplan/30-wifis-dhcp.yaml, SSID='$WIFI_SSID'"
  exit 1
fi
echo "network is up: $(hostname -I 2>/dev/null)"

echo "-- Running kiosk provisioning --"
if [ ! -x "$PROVISION" ]; then
  echo "missing $PROVISION" >&2
  exit 1
fi
if ! "$PROVISION"; then
  echo "Provisioning failed; will retry on next boot." >&2
  exit 1
fi

touch "$STAMP"
systemctl disable homeboard-firstboot.service || true
echo "=== Done: $(date -Is). Rebooting into kiosk. ==="
sleep 2
systemctl reboot
