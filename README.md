# Medicine Reminder

An Android-first Expo/React Native app for keeping a simple local medicine schedule. It records the user's medicines and timing instructions, builds a daily timeline around meal times or fixed times, and schedules local device reminders.

This repository contains an active v1 implementation. It is not a medical advice, diagnosis, dosage, or prescribing tool. Users must enter and verify the medicine, amount, and schedule themselves.

## Current features

- Today's timeline with meal events and medicine doses.
- Medicine add, edit, enable/disable, and delete flows.
- Multiple daily reminder times per medicine.
- Meal-relative schedules before or after breakfast, lunch, or dinner.
- Fixed-time schedules.
- Configurable default breakfast, lunch, and dinner times.
- Today-only meal-time overrides that move linked doses without changing the permanent default.
- Dose states for pending, taken, delayed, and missed display states.
- Configurable delay duration for dose actions (`+5`, `+10`, `+15`, or `+30` minutes).
- Local Android notifications for doses, alarms, hydration, sleep, and test reminders.
- One-off and weekly alarms for appointments or other time-based reminders.
- Dose history for doses marked taken or delayed.
- Local JSON backup export and import.
- Optional AI-assisted medicine-form filling using a copied prompt and pasted JSON. No AI service or API key is bundled with the app.
- Short local sound files for notification and in-app feedback.

## Product boundaries

The app stores data on the device. There is no account, backend, cloud database, cloud sync, advertising, or analytics service in this project.

The app does not infer dosage from a medicine name and does not provide medical instructions for missed doses. Notification delivery depends on Android notification permission and device background/battery settings.

## Technology

- Expo SDK 57
- React Native 0.86
- TypeScript
- AsyncStorage for local persistence
- `expo-notifications` for local notifications
- `expo-audio` for short in-app sounds
- `@react-native-community/datetimepicker` for date and time fields
- Node's built-in test runner through `tsx`

## Requirements

- Node.js and npm
- An Android device or emulator for native testing
- Expo CLI through the project dependencies
- An Expo development build for notification testing; Expo Go does not support this project's notification module on SDK 57

## Setup

```bash
npm install
```

Start the Expo development server:

```bash
npm start
```

For a browser preview of UI and scheduling behavior:

```bash
npx expo start --web
```

The browser preview is useful for UI and local scheduling logic, but it cannot verify Android notification delivery, notification permissions, background behavior, or device sound playback.

## Development commands

```bash
npm test                 # Run scheduling tests
npm run typecheck       # Run TypeScript checks
npm run android         # Open the project on an Android target
```

The automated tests cover meal offsets, meal overrides, active-date filtering, and delayed-dose calculations. Android notification behavior still needs testing in a development build or installed APK on an emulator/device.

## Android builds

The EAS profiles are defined in [`eas.json`](./eas.json):

```bash
npx eas build --profile development --platform android
npx eas build --profile preview --platform android
npx eas build --profile production --platform android
```

The development profile creates an internal development APK. The preview profile creates an internal APK. The current production profile also creates an APK and is intended for installable Android testing, not direct Google Play production upload.

Before a Google Play release, the production profile must be changed to build an Android App Bundle (`.aab`), then the signed bundle, package ID, version code, permissions, privacy information, and Play Console requirements must be verified.

The configured Android application ID is `com.medicinereminder.app`. Treat this identifier as permanent once the app is published.

## Notification notes

- Android notification permission is requested when scheduling a notification.
- The app creates an Android `Reminders` channel with a custom notification sound.
- Dose reminders schedule a main notification and a follow-up reminder if the dose is not marked taken or delayed.
- Recurring hydration, sleep, and weekly alarm reminders are scheduled as individual occurrences over a rolling seven-day window and refreshed when the app opens.
- If notifications are blocked or the app is running in Expo Go, the reminder cannot be scheduled there; use an Android development build or APK.

## Data and backups

App data is stored under the AsyncStorage key `@medicine-reminder/app-data`. The Settings screen can export a JSON backup and import it later. Notification IDs are discarded during import because they belong to the original device/session; the app reschedules supported reminders after opening.

## Project structure

```text
App.tsx                         App entry point and screen navigation
src/screens/                    Today, medicines, alarms, history, settings
src/scheduling/schedule.ts      Pure medicine timeline calculations
src/notifications.ts            Local notification scheduling and cancellation
src/storage/storage.ts          AsyncStorage persistence and migration
src/types/domain.ts             Domain and persisted-data types
src/backup.ts                    JSON backup export/import
tests/scheduling.test.ts         Scheduling unit tests
plugins/withApkName.js           APK output naming config plugin
MEDICINE_REMINDER_APP_SPEC.txt  Product specification and acceptance checklist
```

## Release status

This project is not yet declared production-ready. The source code and laptop scheduling tests are present, but release readiness still requires a successful Android release build, emulator/device notification testing, installation testing, and the final package/release checks described above.

## License

See [`LICENSE`](./LICENSE).
