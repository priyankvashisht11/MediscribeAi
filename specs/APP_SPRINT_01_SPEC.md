# Sprint A1 — Capacitor Shell + Android Build Pipeline

## Goal
Wrap the existing React web app in a Capacitor native shell. Android build compiles and opens the app on a device/emulator showing the landing page. No functional changes to web code.

## Scope

### 1. Capacitor Installation
- `npm install @capacitor/core @capacitor/cli`
- `npx cap init MediScribe in.mediscribe.app`
- `npm install @capacitor/android`
- `npx cap add android`

### 2. `capacitor.config.ts`
```ts
import { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'in.mediscribe.app',
  appName: 'MediScribe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}
export default config
```

### 3. Android `build.gradle` tuning
- `minSdkVersion 23` (Android 6.0+, covers 99% of Indian market)
- `targetSdkVersion 34`
- Set `applicationId "in.mediscribe.app"`

### 4. Build + Sync script
```bash
npm run build && npx cap sync android
```

### 5. Android Studio verify
- Open in Android Studio
- Build → Make Project — must compile with 0 errors
- Run on emulator — must show LandingPage

## Out of Scope
- iOS (Sprint A2 setup, Play Store first)
- Any new features
- Backend changes

## Done When
- [ ] `npx cap sync android` exits 0
- [ ] Android Studio builds APK with 0 errors
- [ ] App opens on emulator/device at LandingPage

## Deploy Step (none this sprint)
No deploy — this is a local build validation sprint.
