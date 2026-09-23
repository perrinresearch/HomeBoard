# HomeBoard

Family board for a wall display, plus a phone for chores and shopping.

Setup for every part of the system is in [SETUP.md](SETUP.md).

| Piece | Doc |
| --- | --- |
| Dashboard, Firebase, weather, calendars | [SETUP.md](SETUP.md) |
| Orange Pi kiosk | [deploy/README.md](deploy/README.md) |
| Android app | [android/README.md](android/README.md) |

```bash
npm install
cp .env.example .env.local
npm start
```

Open `http://localhost:3000`. Put Firebase and OpenWeatherMap keys in `.env.local` before you build for the Pi. Create React App bakes those values into the static files.

On the board, **Settings** is split into Family, Calendars, Sports, Appearance, and Board (Wi-Fi, household, timezone).

When Firebase is configured, family, chores, shopping, sports, and events added on the board sync to phones and to any other kiosk that joins the same household. Appearance, Wi-Fi, timezone, and calendar account tokens stay on each device.
