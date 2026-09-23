# HomeBoard Android

Phone companion for the wall board. A phone joins the household with the email and join code from the board, then edits chores and shopping. Those lists sync through the same Firebase project as the kiosk.

A tablet (smallest width 600dp or more) does not show that phone UI. It opens the full board in a web view at `BOARD_URL`.

Package name: `com.perrinresearch.homeboard`. Minimum Android version: 8.0 (API 26). Compile and target SDK: 34. JDK 17.

## Before you install

Create the Firebase project and the household first. The project steps are in [SETUP.md](../SETUP.md). On the board, **Settings → Board → Household → Create household**, and leave that email and join code on the screen. The phone signs in with those two values.

In that same Firebase project:

- Enable Email/Password sign-in.
- Deploy `firestore.rules` from the repository root.

Register an Android app in that same project:

1. Firebase console → Project settings → Add app → Android.
2. Package name: `com.perrinresearch.homeboard`.
3. Copy the Android app id (`1:…:android:…`), the project id, and an API key.

This project does not use the Google Services Gradle plugin. You do not need `google-services.json`.

From `android/`, copy the example config and fill it in:

```bash
cp firebase.properties.example firebase.properties
```

```properties
FIREBASE_API_KEY=your-android-or-project-api-key
FIREBASE_APP_ID=1:your-project:android:your-app
FIREBASE_PROJECT_ID=your-project-id
BOARD_URL=http://192.168.5.110
```

`FIREBASE_PROJECT_ID` must match `REACT_APP_FIREBASE_PROJECT_ID` in the kiosk build. `BOARD_URL` is only used on a tablet. On the home network use the Pi’s address, such as `http://192.168.5.110`, or `http://homeboard.local` if that name resolves. The app allows plain HTTP so the Pi does not need TLS.

`firebase.properties` is gitignored. The values are compiled into the app, so change the file and then rebuild.

## Install and run from Android Studio

Use Android Studio Koala (2024.1.2) or newer. The project uses Android Gradle Plugin 8.5.2, Gradle 8.7, and JDK 17. Android Studio’s bundled JDK is enough.

1. Install Android Studio and the Android SDK for API 34.
2. **File → Open** and choose this `android` directory, not the repository root.
3. Trust the project and wait for Gradle sync. Sync downloads Gradle 8.7.
4. If sync says the Gradle wrapper is missing, the `gradlew` scripts are not in the repo. From `android/`, with a local Gradle install, run:

   ```bash
   gradle wrapper --gradle-version 8.7
   ```

   Then sync again.
5. **Build → Rebuild Project** after `firebase.properties` exists.
6. Choose the `app` run configuration and press Run.

### Emulator

**Device Manager → Create device.** Use a system image for API 26 or higher.

- Phone (Pixel or similar): join screen, chores, and shopping.
- Tablet (a 10-inch profile, or any profile whose smallest width is at least 600dp): the full board at `BOARD_URL`.

The tablet emulator must reach that URL. For a first test, set `BOARD_URL` to the Pi’s IP, rebuild, and give the emulator network access.

### Phone over USB

1. On the phone, open Settings → About phone and tap the build number until developer options turn on.
2. Settings → Developer options → enable USB debugging.
3. Plug the phone in and accept the debugging prompt.
4. In Android Studio, choose that device in the toolbar and press Run.

The phone and the board must use the same Firebase project. Chores and shopping do not require the phone to be on the same Wi-Fi as the Pi. A tablet loading `BOARD_URL` does need to reach the Pi.

### Phone over Wi-Fi

After one USB install, you can leave the cable off:

1. Developer options → Wireless debugging → turn it on.
2. Pair with the pairing code shown on the phone:

   ```bash
   adb pair <phone-ip>:<pairing-port>
   adb connect <phone-ip>:<debug-port>
   ```

3. Run from Android Studio, or install the debug build:

   ```bash
   cd android
   ./gradlew :app:installDebug
   ```

`adb` comes with the Android SDK platform-tools. `./gradlew` exists only after the wrapper step above.

## What to try

On a phone or a phone-sized emulator:

1. The first screen is **Join household**. Enter the board’s email and join code, then tap **Join**.
2. Open **Shopping**, add an item, and confirm it appears on the board within a few seconds.
3. Check that item off on the phone. Confirm the board updates. Check something off on the board and confirm the phone updates.
4. Open **Chores**, add a chore, and mark it done from each side.
5. Tap **Sign out**, then join again with the same email and code.

On a tablet or a tablet emulator:

1. The screen title is **Full board**.
2. The web view loads `BOARD_URL`. A phone-sized window never shows that web view.

A phone build with an empty `firebase.properties` shows: “Add android/firebase.properties from the Firebase project, then rebuild.”

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Join fails immediately | Email/Password is enabled in Firebase Authentication. The household was created on a kiosk built with the same project id. |
| Join succeeds, lists stay empty | The board is signed into that household. Firestore rules from `firestore.rules` are deployed. |
| Edits on the phone never reach the board | Both apps use the same `FIREBASE_PROJECT_ID`, and the board is still signed in. |
| Tablet shows a connection error | `BOARD_URL` is reachable from that device. Rebuild after changing it. Try the Pi’s IP instead of `homeboard.local`. |
| Config change had no effect | Rebuild. `firebase.properties` is read at compile time. |
| Android Studio cannot find a device | Re-accept the USB debugging prompt, or run `adb devices`. Wireless debugging needs a fresh `adb connect` after the phone sleeps. |
