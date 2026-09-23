#!/bin/bash
# Pre-stage an Armbian image so a freshly flashed card boots straight into
# HomeBoard with no keyboard and no console login.
#
#   ./deploy/stage-card-image.sh --image path/to/Armbian.img --config card.conf
#
# Writes into the image's ext4 partition using debugfs, so this needs no root
# and never touches a physical disk. Flash the resulting image as usual.
#
# What gets injected:
#   /etc/netplan/30-wifis-dhcp.yaml        wifi, so the Pi boots online
#   /boot/homeboard-firstboot.conf         admin user, hostname, timezone
#   /usr/local/bin/homeboard-firstboot.sh  unattended setup, runs once
#   /usr/local/lib/homeboard/provision-pi.sh
#   /usr/local/share/homeboard/build.tar.gz  the dashboard itself
#   ...and /root/.not_logged_in_yet is removed so Armbian's interactive
#   setup wizard never gates login.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
PART_OFFSET_MB=4          # Armbian sunxi images: single partition at sector 8192
IMAGE="" CONFIG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --image)  IMAGE="$2"; shift 2 ;;
    --config) CONFIG="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

[ -f "$IMAGE" ]  || { echo "--image is required and must exist" >&2; exit 1; }
[ -f "$CONFIG" ] || { echo "--config is required and must exist" >&2; exit 1; }

WIFI_SSID="" WIFI_PSK="" WIFI_COUNTRY="US"
ADMIN_USER="" ADMIN_PASSWORD="" ADMIN_SSH_KEY=""
HOSTNAME_NEW="homeboard" TIMEZONE=""
# Optional: pin an address instead of using DHCP.
STATIC_IP="" STATIC_GATEWAY="" STATIC_DNS="1.1.1.1,8.8.8.8"

# A config written on Windows carries CRLF, and the trailing \r ends up inside
# the quoted values - an SSID of "YT-1300\r" matches no network, and the stray
# \r also breaks the generated YAML. Source a sanitised copy instead.
CONFIG_CLEAN=$(mktemp)
tr -d '\r' < "$CONFIG" > "$CONFIG_CLEAN"
# shellcheck disable=SC1090
source "$CONFIG_CLEAN"
rm -f "$CONFIG_CLEAN"

[ -n "$WIFI_SSID" ] || { echo "WIFI_SSID must be set in $CONFIG" >&2; exit 1; }
[ -n "$WIFI_PSK" ]  || { echo "WIFI_PSK must be set in $CONFIG" >&2; exit 1; }
[ -d "$REPO/build" ] || { echo "No $REPO/build - run 'npm run build' first" >&2; exit 1; }

DEBUGFS=$(command -v debugfs || echo /sbin/debugfs)
[ -x "$DEBUGFS" ] || { echo "debugfs not found (install e2fsprogs)" >&2; exit 1; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "== Packing dashboard build =="
tar -czf "$WORK/build.tar.gz" -C "$REPO/build" .
echo "   $(du -h "$WORK/build.tar.gz" | cut -f1)"

echo "== Extracting ext4 partition from image =="
dd if="$IMAGE" of="$WORK/rootfs.img" bs=1M skip="$PART_OFFSET_MB" status=none
FREE_KB=$( { $DEBUGFS -R "stats -h" "$WORK/rootfs.img" 2>/dev/null || true; } \
  | awk '/Free blocks:/ {print $3*4}')
echo "   free space in image: ${FREE_KB:-unknown} KB"

echo "== Generating config =="
{
  echo "# Added by HomeBoard card staging. Merges with Armbian's"
  echo "# 10-dhcp-all-interfaces (which only covers ethernet), so no conflict."
  echo "network:"
  echo "  version: 2"
  echo "  renderer: networkd"
  echo "  wifis:"
  echo "    wlan0:"
  if [ -n "$STATIC_IP" ]; then
    echo "      dhcp4: no"
    echo "      addresses: [$STATIC_IP]"
    [ -n "$STATIC_GATEWAY" ] && {
      echo "      routes:"
      echo "        - to: default"
      echo "          via: $STATIC_GATEWAY"
    }
    echo "      nameservers:"
    echo "        addresses: [$STATIC_DNS]"
  else
    echo "      dhcp4: yes"
  fi
  echo "      regulatory-domain: $WIFI_COUNTRY"
  echo "      access-points:"
  echo "        \"$WIFI_SSID\":"
  echo "          password: \"$WIFI_PSK\""
} | tr -d '\r' > "$WORK/30-wifis-dhcp.yaml"
echo "   network: ${STATIC_IP:-DHCP}"

# Validate what we actually generated, not an equivalent typed by hand. netplan
# discards every interface definition if any file fails to parse, so a bad
# file here means the Pi boots with no network at all.
if command -v python3 >/dev/null; then
  python3 -c "
import sys, yaml
f = '$WORK/30-wifis-dhcp.yaml'
try:
    d = yaml.safe_load(open(f))
except Exception as e:
    sys.exit('generated netplan YAML is invalid: %s' % e)
ap = d['network']['wifis']['wlan0']['access-points']
ssid = list(ap)[0]
if ssid.strip() != ssid or '\r' in ssid:
    sys.exit('SSID has stray whitespace: %r' % ssid)
print('   netplan YAML validated, ssid=%r' % ssid)
" || exit 1
fi

tr -d '\r' > "$WORK/homeboard-firstboot.conf" << EOF
# Consumed by /usr/local/bin/homeboard-firstboot.sh on first boot.
ADMIN_USER="$ADMIN_USER"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
ADMIN_SSH_KEY="$ADMIN_SSH_KEY"
HOSTNAME_NEW="$HOSTNAME_NEW"
TIMEZONE="$TIMEZONE"
WIFI_SSID="$WIFI_SSID"
EOF

# debugfs refuses to overwrite an existing file, so remove before writing.
# Modes are octal with the file-type bits included (0100644 = regular 0644).
cat > "$WORK/cmds" << EOF
mkdir /usr/local/lib/homeboard
mkdir /usr/local/share/homeboard

rm /root/.not_logged_in_yet

rm /etc/netplan/30-wifis-dhcp.yaml
write $WORK/30-wifis-dhcp.yaml /etc/netplan/30-wifis-dhcp.yaml
sif /etc/netplan/30-wifis-dhcp.yaml mode 0100600
sif /etc/netplan/30-wifis-dhcp.yaml uid 0
sif /etc/netplan/30-wifis-dhcp.yaml gid 0

rm /boot/homeboard-firstboot.conf
write $WORK/homeboard-firstboot.conf /boot/homeboard-firstboot.conf
sif /boot/homeboard-firstboot.conf mode 0100600
sif /boot/homeboard-firstboot.conf uid 0
sif /boot/homeboard-firstboot.conf gid 0

rm /usr/local/bin/homeboard-firstboot.sh
write $HERE/firstboot/homeboard-firstboot.sh /usr/local/bin/homeboard-firstboot.sh
sif /usr/local/bin/homeboard-firstboot.sh mode 0100755
sif /usr/local/bin/homeboard-firstboot.sh uid 0
sif /usr/local/bin/homeboard-firstboot.sh gid 0

rm /usr/local/lib/homeboard/provision-pi.sh
write $HERE/provision-pi.sh /usr/local/lib/homeboard/provision-pi.sh
sif /usr/local/lib/homeboard/provision-pi.sh mode 0100755
sif /usr/local/lib/homeboard/provision-pi.sh uid 0
sif /usr/local/lib/homeboard/provision-pi.sh gid 0

rm /usr/local/share/homeboard/build.tar.gz
write $WORK/build.tar.gz /usr/local/share/homeboard/build.tar.gz
sif /usr/local/share/homeboard/build.tar.gz mode 0100644
sif /usr/local/share/homeboard/build.tar.gz uid 0
sif /usr/local/share/homeboard/build.tar.gz gid 0

rm /etc/systemd/system/homeboard-firstboot.service
write $HERE/firstboot/homeboard-firstboot.service /etc/systemd/system/homeboard-firstboot.service
sif /etc/systemd/system/homeboard-firstboot.service mode 0100644
sif /etc/systemd/system/homeboard-firstboot.service uid 0
sif /etc/systemd/system/homeboard-firstboot.service gid 0

rm /etc/systemd/system/multi-user.target.wants/homeboard-firstboot.service
symlink /etc/systemd/system/multi-user.target.wants/homeboard-firstboot.service /etc/systemd/system/homeboard-firstboot.service
EOF

echo "== Injecting into image =="
# Many of the rm/mkdir lines are expected to fail on a clean image; real
# problems are caught by the verification pass below.
$DEBUGFS -w -f "$WORK/cmds" "$WORK/rootfs.img" > "$WORK/debugfs.log" 2>&1 || true
grep -iE 'write.*(File exists|not found)|Invalid|could not' "$WORK/debugfs.log" \
  | grep -viE 'not_logged_in_yet|multi-user.target.wants|30-wifis|homeboard-firstboot|build.tar.gz|provision-pi|File exists.*mkdir' || true

echo "== Verifying injected files =="
FAIL=0
for f in \
  /etc/netplan/30-wifis-dhcp.yaml \
  /boot/homeboard-firstboot.conf \
  /usr/local/bin/homeboard-firstboot.sh \
  /usr/local/lib/homeboard/provision-pi.sh \
  /usr/local/share/homeboard/build.tar.gz \
  /etc/systemd/system/homeboard-firstboot.service \
  /etc/systemd/system/multi-user.target.wants/homeboard-firstboot.service
do
  if $DEBUGFS -R "stat $f" "$WORK/rootfs.img" 2>/dev/null | grep -q '^Inode:'; then
    echo "   ok      $f"
  else
    echo "   MISSING $f"; FAIL=1
  fi
done
if $DEBUGFS -R "stat /root/.not_logged_in_yet" "$WORK/rootfs.img" 2>/dev/null | grep -q '^Inode:'; then
  echo "   NOT REMOVED /root/.not_logged_in_yet"; FAIL=1
else
  echo "   ok      /root/.not_logged_in_yet removed"
fi
[ "$FAIL" -eq 0 ] || { echo "Injection incomplete; image not modified." >&2; exit 1; }

echo "== Filesystem check =="
E2FSCK=$(command -v e2fsck || echo /sbin/e2fsck)
"$E2FSCK" -fn "$WORK/rootfs.img" > "$WORK/fsck.log" 2>&1 || {
  echo "e2fsck reported problems:" >&2; cat "$WORK/fsck.log" >&2; exit 1; }
tail -2 "$WORK/fsck.log"

echo "== Writing partition back into image =="
dd if="$WORK/rootfs.img" of="$IMAGE" bs=1M seek="$PART_OFFSET_MB" conv=notrunc status=none
sync

echo
echo "Staged: $IMAGE"
echo "Flash it to the card, insert it, and power on. First boot joins wifi,"
echo "installs the kiosk, then reboots into the dashboard (allow ~10 min)."
