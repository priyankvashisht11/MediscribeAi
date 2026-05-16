# Sprint A2 — Auth Flows Native + Deep Link Handling

## Goal
Login, Signup, Forgot Password, Reset Password all work on Android. JWT stored in Capacitor Preferences (not localStorage — more secure on mobile). Deep links for password reset emails open the app correctly.

## Scope

### 1. Capacitor Preferences (replaces localStorage for token)
- `npm install @capacitor/preferences`
- Create `src/utils/storage.js` — wrapper with `get/set/remove` that uses Capacitor Preferences on native, localStorage on web
- Replace all `localStorage.getItem/setItem/removeItem('mediscribe_token')` calls with the wrapper

### 2. Deep Link — Reset Password
- Android app registers `mediscribe://reset-password` scheme
- Backend `reset_url` uses `mediscribe://reset-password?token=...` when `User-Agent` indicates Android app (or feature-flagged via env)
- `AndroidManifest.xml` intent filter for `mediscribe://` scheme
- React Router reads the URL on app start — handles the token

### 3. Cookie handling for refresh token
- Capacitor's HTTP plugin handles cookies natively
- `withCredentials: true` already set on axios — works in WebView
- Verify refresh flow works end-to-end on device

### 4. Keyboard + safe area insets
- `npm install @capacitor/keyboard`
- Add `<meta name="viewport" content="... viewport-fit=cover">` 
- CSS: `padding-bottom: env(safe-area-inset-bottom)` on input screens

## Out of Scope
- Biometric login (future sprint)
- iOS

## Done When
- [ ] Login flow works on Android device
- [ ] Token survives app kill/restart (Preferences, not localStorage)
- [ ] Forgot password email link opens app at reset-password screen
- [ ] Refresh token rotates correctly on Android

## Notes
- `mediscribe_token` key stays the same — only the storage mechanism changes
- Web (Vercel) continues using localStorage — wrapper detects platform
