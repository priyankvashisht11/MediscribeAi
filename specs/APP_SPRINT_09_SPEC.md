# Sprint A9 — Settings + Analytics + Clinic Admin (Mobile)

## Goal
Settings, Analytics, and Clinic Admin screens are usable on mobile. Feature parity with web. No new features — adaptation only.

## Scope

### 1. Settings (mobile)
- List-style settings (iOS/Android native pattern)
- Sections: Account, Clinic, Security, About
- Account: name, specialty, email (read-only), change password button
- Security: logout button (prominent, bottom of screen)
- About: version number, "Powered by MediScribe" + build number

### 2. Analytics (mobile)
- Stat cards: 2-column grid (was 4-column on web)
- Chart: horizontal scroll if too wide, or stacked bar instead of grouped
- Date range picker: native bottom sheet date picker
- Export button: triggers share sheet with CSV

### 3. Clinic Admin (mobile)
- Doctors list: card per doctor, role badge, active/inactive toggle
- Invite new doctor: bottom sheet form (same flow as web)
- Invite link: copy to clipboard → `@capacitor/clipboard`
- `npm install @capacitor/clipboard`

### 4. `@capacitor/clipboard` usage
- Copy invite link → `Clipboard.write({ string: inviteUrl })`
- "Copied!" toast for 2s

### 5. Offline state handling
- Detect no network via `@capacitor/network`
- `npm install @capacitor/network`
- Show "No internet connection" banner when offline
- Cached data still displays (React Query cache)

## Out of Scope
- Offline note editing (complex sync — future)
- Push notifications for new sessions

## Done When
- [ ] Settings screen renders cleanly on mobile, logout works
- [ ] Analytics stats visible without horizontal scroll
- [ ] Clinic admin: invite link copies to clipboard
- [ ] Offline banner appears when network dropped
- [ ] All three screens work on web unchanged
