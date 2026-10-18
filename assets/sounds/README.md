# Sound files

These 4 files already exist here as **silent placeholders** so the app keeps
working right now. Replace each one with a real sound — same filename, same
`.wav` extension — and it just works, no code changes needed.

| File               | Used for                                           | Pick a clip from                                 |
| ------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `notification.wav`  | The OS notification sound (dose reminders, alarms)   | https://mixkit.co/free-sound-effects/notification/  |
| `complete.wav`      | Tapping "Taken"                                      | https://mixkit.co/free-sound-effects/correct/        |
| `snooze.wav`        | Tapping "+15 min"                                    | https://mixkit.co/free-sound-effects/beep/           |
| `add.wav`           | Adding a medicine or alarm                           | https://mixkit.co/free-sound-effects/interface/      |

**Mixkit gives you `.mp3`.** Convert it to `.wav` before saving here — takes
10 seconds at https://cloudconvert.com/mp3-to-wav (upload, convert, download),
then rename the result to match the table above exactly.

Keep each clip short (under 3 seconds) — Android truncates long notification
sounds anyway, and long UI sound effects feel laggy.

- `notification.wav` needs a full rebuild (`eas build`) to take effect — it's
  baked into the native app, can't hot-reload.
- `complete.wav` / `snooze.wav` / `add.wav` hot-reload instantly — just
  replace the file and reload the app.
