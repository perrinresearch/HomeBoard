# Setup

HomeBoard has four pieces. Set them up in this order.

| Piece | What it is | Guide |
| --- | --- | --- |
| Dashboard | The React app | [On a computer](#1-dashboard-on-a-computer) |
| Firebase | Shared household: family, chores, shopping, sports, events | [Firebase](#2-firebase) |
| Kiosk | The Orange Pi that shows the board full screen | [deploy/README.md](deploy/README.md) |
| Calendars | Google, Microsoft, and Apple on the Pi | [Calendars](#4-calendars) |
| Android | Phone chores and shopping; tablet opens the board | [android/README.md](android/README.md) |

Weather, Wi-Fi, timezone, and appearance do not need their own servers. Weather needs an API key in the same env file as Firebase. Wi-Fi, timezone, and appearance are changed in **Settings** on the board after the kiosk is running.

## 1. Dashboard on a computer

Requirements: Node.js 18 or newer.

```bash
npm install
cp .env.example .env.local
npm start
```

Open `http://localhost:3000`. Fill in `.env.local` before you rely on weather or household sync. Create React App reads that file at build time, so change it and start or build again.

Without Firebase keys the board still runs. Family, chores, shopping, and sports stay in that browser only. Settings → Board → Household says the keys are missing.

Calendar sign-in does not work in this preview. Google and Microsoft redirect to `http://127.0.0.1` on the Pi. Connect those accounts from the kiosk.

## 2. Firebase

One Firebase project is shared by every kiosk and every phone. Create it once.

### Create the project

1. Open [Firebase console](https://console.firebase.google.com/) and create a project. Analytics is optional.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.** Save. Do not enable email link only. The board creates a normal email and password (the join code is the password).
3. **Build → Firestore Database → Create database.** Start in production mode. The rules file below is what actually allows access.

### Register the web app

1. Project settings (gear) → **General** → **Your apps** → add a **Web** app. Name it `HomeBoard`.
2. Copy the config into `.env.local`:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project
REACT_APP_FIREBASE_APP_ID=1:...:web:...
REACT_APP_OPENWEATHER_API_KEY=...
```

`authDomain` looks like `your-project.firebaseapp.com`. `appId` is the web app id, not the Android one.

### Deploy the security rules

`firestore.rules` allows a signed-in user to read and write only the household document whose id is their user id. Deploy it with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore --project YOUR_PROJECT_ID
```

`firebase.json` in the repo root points the CLI at `firestore.rules`. You do not need a `.firebaserc` if you pass `--project`.

Until this deploy succeeds, the board can sign in and then fail to save the household.

### Use it on the board

Rebuild so the keys are inside the static files, then deploy that build to the Pi ([Kiosk](#3-kiosk)):

```bash
npm run build
./deploy/push-build.sh scott@<pi-address>
```

On the kiosk: **Settings → Board → Household → Create household.** Leave the email and join code on the screen. Phones and a second kiosk join with those two values. The join code is the Firebase password. It is stored in that browser only, not in Firestore.

### What syncs

| Syncs across devices signed into the household | Stays on each device |
| --- | --- |
| Family members | Appearance |
| Chores and shopping | Wi-Fi |
| Sports | Timezone (the Pi's clock) |
| Events added on the board | Google, Microsoft, and Apple tokens (on that Pi) |
| Calendar events copied up from a Pi | |

A second kiosk joins the same household and then sees the shared lists. Connect calendars on that Pi too. A board with no calendar accounts still publishes an empty calendar into the household and would replace events another Pi had uploaded. Connect the accounts before you rely on that second board for calendars.

### Optional: Pi uploads calendars when the screen is off

The signed-in board already copies fetched events into Firestore. To have the Pi do that itself, create a service account:

1. Project settings → **Service accounts** → **Generate new private key**.
2. Copy the JSON to the Pi as `/etc/homeboard/firebase-service-account.json` and `chmod 600` it.
3. `sudo systemctl restart homeboard-calendar`

The board posts its household id to the Pi after sign-in. The service account must be from this same Firebase project. Do not commit the JSON file.

## 3. Kiosk

The wall display is an Orange Pi Zero 2W running the static build under nginx, with Chromium in kiosk mode. Full image, flash, and day-to-day deploy steps are in [deploy/README.md](deploy/README.md).

The build you flash or push must already contain the Firebase and weather keys from `.env.local`. `./deploy/push-build.sh` runs `npm run build` on this computer, then copies the result to the Pi.

After the dashboard is on screen:

- **Settings → Board** — Wi-Fi, household, timezone
- **Settings → Appearance** — theme
- **Settings → Family** — people
- **Settings → Calendars** — Google, Microsoft, and Apple
- **Settings → Sports** — sports for those people

## 4. Calendars

Calendar sign-in is a small service on the Pi, `homeboard-calendar`. The browser never sees the client secrets or refresh tokens. Several Gmail accounts, several Microsoft accounts, and several iCloud share links can be connected. Each new sign-in adds an account. Signing in again with the same address updates that account.

Put the OAuth client id and secret in `/etc/homeboard/calendar.env` (mode 600). Start from [deploy/calendar-broker/calendar.env.example](deploy/calendar-broker/calendar.env.example). Then:

```bash
sudo systemctl restart homeboard-calendar
```

### Google

1. In Google Cloud, enable the Google Calendar API.
2. OAuth consent screen: External. While the app is in testing, add every Gmail address you will connect as a test user.
3. Create an OAuth client of type **Web application**.
4. Authorized redirect URI: `http://127.0.0.1/api/google/callback`

That address is valid for a Web client. It only works in the kiosk browser, because `127.0.0.1` is the Pi itself.

### Microsoft

1. App registration that allows personal Microsoft accounts.
2. Redirect URI (Web): `http://127.0.0.1/api/microsoft/callback`
3. Delegated permission `Calendars.Read`, and a client secret.

### Apple

Apple is not a sign-in. In iCloud Calendar, share the calendar and paste the `webcal://` or `https://` link under **Settings → Calendars** for that person.

### On the board

**Settings → Calendars.** Pick a person, then **Add account**. Google and Microsoft ask which account to use. Calendars from that sign-in that are not already assigned are given to the person you had selected. While the provider page is open, a keyboard is drawn on the page and **Cancel sign-in** returns to the dashboard.

## 5. Weather

The board uses OpenWeatherMap. Create a key at [openweathermap.org/api](https://openweathermap.org/api) and set `REACT_APP_OPENWEATHER_API_KEY` in `.env.local`, then rebuild. The free tier is enough. If the key is missing, the app uses a placeholder and weather requests fail.

Set the place under the weather readout on the board (**Weather location**).

## 6. Android

After the Firebase project exists and the board has a household, follow [android/README.md](android/README.md). The phone uses the same project id. Register a separate Android app in Firebase; its app id is not the web app id.

## 7. Where to look when something fails

| Symptom | Check |
| --- | --- |
| Household section says Firebase is not configured | `.env.local` keys, then rebuild and redeploy. |
| Create household fails after sign-in | Email/Password provider is on, and `firebase deploy --only firestore` succeeded. |
| Phone edits never reach the board | Same `projectId`, and the board is still signed in. |
| Calendar connect fails on a laptop | Connect from the kiosk. The redirect is `127.0.0.1` on the Pi. |
| `redirect_uri_mismatch` | The Google or Microsoft client has the exact redirect URI above. |
| Second board shows no Google events | Connect those accounts on that Pi. An empty fetch overwrites the shared calendar. |
| Black screen, site responds on the Pi | [deploy/README.md](deploy/README.md) troubleshooting. |
