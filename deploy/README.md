# Orange Pi kiosk deploy

HomeBoard runs on the Pi as a static build served by nginx on port 80, with
Chromium auto-starting fullscreen at boot. Node is not needed on the device.

This replaces the earlier setup, which ran `npm start` (webpack-dev-server) on
port 3000 as the kiosk's web server. That kept a file watcher and build cache
writing to the SD card continuously, which is the most likely reason the first
card failed.

Use an A1/A2-rated card. Class 10 cards without an endurance rating fail quickly
under a 24/7 display workload.

## Option A: pre-staged card (no keyboard needed)

Recommended for a fresh card. Everything is injected into the image before it
is flashed, so the Pi joins wifi, installs the kiosk, and comes up showing the
dashboard without ever needing a console login.

Download the Armbian **Debian 13 Trixie Minimal** image for `orangepizero2w`
and verify it:

```bash
mkdir -p ~/armbian && cd ~/armbian
curl -fLo Trixie_current_minimal.img.xz https://dl.armbian.com/orangepizero2w/Trixie_current_minimal
curl -fLo Trixie_current_minimal.sha     https://dl.armbian.com/orangepizero2w/Trixie_current_minimal.sha
sha256sum -c --ignore-missing <(sed 's/Armbian.*/Trixie_current_minimal.img.xz/;s/ .*/  Trixie_current_minimal.img.xz/' Trixie_current_minimal.sha) || \
  sha256sum Trixie_current_minimal.img.xz   # compare against the .sha by eye
xz -dk Trixie_current_minimal.img.xz
```

Write a card config (keep it out of git — it holds your wifi key):

```bash
cat > ~/armbian/card.conf << 'EOF'
WIFI_SSID="your-ssid"
WIFI_PSK="your-wifi-password"
WIFI_COUNTRY="US"
ADMIN_USER="scott"
ADMIN_PASSWORD="choose-one"
ADMIN_SSH_KEY=""          # optional: an ssh public key line
HOSTNAME_NEW="homeboard"
TIMEZONE="America/New_York"
EOF
chmod 600 ~/armbian/card.conf
```

Build the dashboard (with `.env.local` filled in; see [SETUP.md](../SETUP.md)) and stage the image:

```bash
npm run build
./deploy/stage-card-image.sh --image ~/armbian/Trixie_current_minimal.img --config ~/armbian/card.conf
```

Staging uses `debugfs` to write into the image's ext4 partition, so it needs no
root and never touches a physical disk. It verifies every injected file and runs
`e2fsck` before writing the partition back.

Then flash `Trixie_current_minimal.img` with Raspberry Pi Imager, balenaEtcher,
or `dd`, insert the card, and power on. First boot joins wifi, installs
packages, unpacks the baked-in build, and reboots into the dashboard. Allow
about 10 minutes; the screen stays on a console until the reboot.

If it does not come up, SSH in as your admin user and read the log:

```bash
ssh scott@homeboard.local 'sudo cat /var/log/homeboard-firstboot.log'
```

The first-boot service stays enabled until it succeeds, so a wifi typo means
fix it from Settings on the board (or edit `/etc/netplan/30-wifis-dhcp.yaml`
and reboot), not "reflash".

### What staging injects

| Path | Purpose |
| --- | --- |
| `/etc/netplan/30-wifis-dhcp.yaml` | wifi, so the Pi boots online |
| `/boot/homeboard-firstboot.conf` | admin user, hostname, timezone |
| `/usr/local/bin/homeboard-firstboot.sh` | unattended setup, runs once |
| `/usr/local/lib/homeboard/provision-pi.sh` | the kiosk provisioning itself |
| `/usr/local/share/homeboard/build.tar.gz` | the dashboard build |

Staging also deletes `/root/.not_logged_in_yet`, which is what normally forces
Armbian's interactive setup wizard. Because that wizard is also what forces the
default root password to be changed, the first-boot script locks the root
account and sets `PermitRootLogin no` instead.

## Option B: provision an already-running Pi

If the Pi is already booted with network and a sudo user:

```bash
scp deploy/provision-pi.sh scott@<pi-address>:/tmp/
ssh scott@<pi-address> 'bash /tmp/provision-pi.sh'
./deploy/push-build.sh scott@<pi-address>
```

`provision-pi.sh` runs either as root or via sudo, so the same script serves
both this path and first boot.

It installs nginx, Chromium, and a minimal X stack, creates the `homeboard`
kiosk user, registers a `HomeBoard Kiosk` X session, turns on LightDM autologin
into that session, and caps journald to RAM. Because the session runs the
browser directly instead of a desktop, there is no panel, no wallpaper, and no
window decoration — only HomeBoard is on screen.

## Day-to-day

Deploy a change and restart the browser without rebooting:

```bash
./deploy/push-build.sh scott@<pi-address>
ssh scott@<pi-address> 'sudo pkill -u homeboard chromium'
```

The launcher loop brings Chromium back within a few seconds.

## Calendars

Google and Outlook sign-in, and Apple share links, are handled by a small
service on the Pi (`homeboard-calendar`). The browser never sees the client
secrets or refresh tokens. `./deploy/push-build.sh` installs that service and
proxies `http://127.0.0.1/api/` to it. Several accounts of each kind can be
connected. How to create the Firebase project, the OAuth clients, and the
weather key is in [SETUP.md](../SETUP.md).

The build copied to the Pi must already contain the Firebase and weather keys.
`./deploy/push-build.sh` runs `npm run build` on the computer where
`.env.local` lives.

Settings on the board:

- **Board** — Wi-Fi, household sign-in, timezone. The header Wi-Fi chip opens
  this. Saving a timezone restarts the kiosk browser. The dashboard stays up
  while Wi-Fi reconnects because the kiosk loads from `http://127.0.0.1/`.
- **Family** — people used by chores, sports, and calendars
- **Calendars** — connect Gmail, Microsoft, and iCloud links for a person
- **Appearance** — theme
- **Sports** — sports for those people

Create the two cloud apps once, then put the ids and secrets in
`/etc/homeboard/calendar.env` on the Pi (mode 600). A template is
`deploy/calendar-broker/calendar.env.example`. Restart the service after editing
it: `sudo systemctl restart homeboard-calendar`.

Google Cloud:

- Enable the Google Calendar API.
- OAuth consent screen: External, and add every Gmail address as a test user
  while the app is in testing.
- Create a Web client. Authorized redirect URI:
  `http://127.0.0.1/api/google/callback`

Microsoft Entra (Azure):

- App registration that allows personal Microsoft accounts.
- Redirect URI (Web): `http://127.0.0.1/api/microsoft/callback`
- Delegated permission `Calendars.Read`, and a client secret.

Apple is not a sign-in. In iCloud Calendar, share the calendar and paste the
`webcal://` or `https://` link. While a Google or Microsoft page is open, a
keyboard is drawn on the page and **Cancel sign-in** returns to the dashboard.

Optional: a Firebase service account at
`/etc/homeboard/firebase-service-account.json` lets this service upload events
when the screen is asleep. Steps are in [SETUP.md](../SETUP.md).

## Where state lives

With a household signed in, family, chores, shopping, sports, and events added
on the board are in Firestore. A copy remains in browser `localStorage` in
`/home/homeboard/.homeboard-chrome` so a network blip does not blank the
screen. Appearance stays in that profile. Google, Microsoft, and Apple tokens
stay in `/var/lib/homeboard/calendar.json` on that Pi.

Reflashing the card drops the Chrome profile and the tokens. The Firestore
household remains. Back up `/home/homeboard/.homeboard-chrome` and
`/var/lib/homeboard` if you care about the local copy and the calendar
sign-ins.

## Troubleshooting

Check the pieces independently:

```bash
curl -I http://127.0.0.1/            # nginx serving the build
curl http://127.0.0.1/api/wifi       # Wi-Fi status from Settings
systemctl status nginx lightdm       # web server and display manager
pgrep -au homeboard chromium         # browser running as the kiosk user
```

If the screen is black but `curl` works, the X session is the problem — look at
`/home/homeboard/.xsession-errors`. If Chromium is up but shows an error page,
nginx or the build is the problem.
