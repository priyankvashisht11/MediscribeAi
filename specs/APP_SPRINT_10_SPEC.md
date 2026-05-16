# Sprint A10 — Play Store Submission: Icons, Splash, AAB, Listing

## Goal
MediScribe is live on Google Play Store. Signed AAB uploaded. Store listing complete. Internal test track first, then production release.

## Scope

### 1. App icon
- 1024×1024 master icon: teal background (#016c72), white M lettermark
- Generate all required sizes via `npx @capacitor/assets generate`
- Adaptive icon for Android 8+: foreground layer (M) + background layer (teal)

### 2. Splash screen
- `npm install @capacitor/splash-screen`
- 2732×2732 master splash: teal bg, white MediScribe wordmark centered
- Shown for 2s on app launch then fades out

### 3. Signing keystore
- Generate: `keytool -genkey -v -keystore mediscribe-release.jks -alias mediscribe -keyalg RSA -keysize 2048 -validity 10000`
- Store password in 1Password / secure note — NEVER commit to git
- `.gitignore` must include `*.jks`, `*.keystore`

### 4. `build.gradle` release config
```gradle
signingConfigs {
    release {
        storeFile file('mediscribe-release.jks')
        storePassword System.getenv('KEYSTORE_PASSWORD')
        keyAlias 'mediscribe'
        keyPassword System.getenv('KEY_PASSWORD')
    }
}
```

### 5. Build AAB
```bash
cd android && ./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 6. Play Store setup (Priyank does this — $25 one-time)
- Create app in Play Console
- Package: `in.mediscribe.app`
- Category: Medical
- Content rating: complete questionnaire (no violence, no user data sold)

### 7. Store listing assets
- Short description (80 chars): "AI scribe for doctors — SOAP notes in 30 seconds"
- Full description (4000 chars): feature list, how it works, privacy note
- Screenshots: 3-5 phone screenshots (from emulator)
- Feature graphic: 1024×500 banner

### 8. Privacy Policy page
- Simple static page: `mediscribe-ai-eight.vercel.app/privacy`
- Add `/privacy` route to React app
- Required by Play Store for medical apps

### 9. Internal test → Production
- Upload AAB to Internal Testing track first
- Add Priyank as tester, verify on device
- After approval: promote to Production (1-3 day review)

## Non-Negotiable Costs (this sprint)
- Google Play Developer Account: **$25 one-time** (Priyank buys)

## Done When
- [ ] App icon looks sharp on device (no pixelation)
- [ ] Splash screen shows on launch
- [ ] Signed AAB builds with 0 errors
- [ ] AAB uploaded to Play Console Internal Testing track
- [ ] Privacy policy page live at vercel URL
- [ ] At least 1 successful install from Play Store on test device

## Post-Sprint
- Monitor crash reports in Play Console (free)
- Respond to Play Store review comments
