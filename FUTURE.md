# Future: speakers, microphone, and a language model

Screen timers and reminders already exist. Voice and sound should call the same data, not a second copy of it. Timers and reminders live on the household (`timers` and `reminders` in app state, synced through Firestore).

## Hooks already in the app

- `wakeScreen()` in `src/components/ScreenSleep.tsx` wakes the clock screen. Touch uses it, and the “HomeBoard” wake word uses it. Room-sound wake is off so speech recognition can keep the mic.
- `announceAlert()` in `src/services/alerts.ts` fires a `homeboard-alert` event when a timer finishes or a reminder comes due. `listenForAlerts()` plays the kiosk alarm tone and shows a Stop button. The tone is chosen under Settings → Board → Alarm and stays on that device.
- `listenForVoiceCommands()` in `src/services/voiceListen.ts` waits for the wake word “HomeBoard”, then turns the next phrase into the same `BoardTimer` / `BoardReminder` objects the on-screen forms create, or calls `stopAlarm()`. A Listening chip shows while it is waiting for that command. The kiosk hears that through on-device transcripts (`homeboard-voice`); it does not change Wi-Fi, timezone, or calendar tokens.

## When the microphone and a language model arrive

- Set a timer or reminder by voice. The command creates the same `BoardTimer` or `BoardReminder` the on-screen forms create.
- Speak a due timer or reminder through the same `homeboard-alert` event, using `detail.label`, after or instead of the tone. `stopAlarm()` should stop that speech as well as the tone.
- Keep the on-screen notice until someone dismisses it. Stop only silences the sound.
- Wake the sleep screen when the room gets loud or someone is moving nearby, using `wakeScreen()`. The clock, date, and any active timers or reminders stay on that screen.
- Confirm by voice that a timer was started or a reminder was saved, so the board is usable without looking at the form.

## When a language model is connected

- Turn a loose phrase into a timer or reminder ("in 20 minutes", "tomorrow at 7", "when the kids get home" only if a time can be resolved).
- Answer questions from data the board already has: today's chores, the shopping list, and the calendar.
- Read a due reminder aloud in a short sentence, including the name and the time, from the same `homeboard-alert` event the tone already uses.
- Refuse anything that is not a household request. The model should not change Wi-Fi, timezone, or calendar account tokens.

## Keep separate

Appearance, the alarm tone, Wi-Fi, timezone, and the Google, Microsoft, and Apple tokens stay on each kiosk. Voice can read and create household items. It should not be the way those device settings are changed.
