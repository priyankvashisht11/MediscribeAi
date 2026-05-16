# Sprint A4 — Mobile UI: Navigation + Dashboard + Session List

## Goal
All navigation, dashboard, and session list screens are mobile-optimized. Bottom tab bar replaces the sidebar. Looks and feels like a native app — not a pinched website.

## The Problem
`AppShell.jsx` uses a left sidebar (`Sidebar.jsx`) which is a desktop pattern. On a 6-inch phone this eats the screen. Mobile needs bottom tabs.

## Scope

### 1. Platform-aware AppShell
```js
import { Capacitor } from '@capacitor/core'
// If Capacitor.isNativePlatform() → render BottomTabBar
// Else → render existing Sidebar (web unchanged)
```

### 2. `BottomTabBar.jsx` — new component
- 4 tabs: Home (dashboard), Sessions, Patients, Settings
- Active tab indicator (teal underline / fill)
- Icons: use existing emoji or add `@capacitor/assets` icons
- Fixed at bottom, respects safe-area-inset-bottom

### 3. Dashboard mobile layout
- Stats cards stack vertically (already responsive via grid, verify)
- "New Session" FAB (Floating Action Button) — large teal circle, bottom-right
- Recent sessions list: full-width cards, larger touch targets (min 48px height)

### 4. SessionHistory mobile
- List items: full width, swipe hint arrow
- Filter chips (Active / All) — horizontal scroll, not dropdown

### 5. Touch targets
- All buttons min 44×44px (Apple HIG / Material standard)
- Input fields min 48px height
- No hover-only states

### 6. Status bar
- `npm install @capacitor/status-bar`
- Set status bar style: light content on teal background on splash

## Out of Scope
- Gesture navigation (swipe back)
- Animations between screens

## Done When
- [ ] Bottom tab bar visible on Android, sidebar on web — platform switch works
- [ ] Dashboard renders without horizontal scroll on 360px wide device
- [ ] "New Session" FAB navigates to NewSession
- [ ] Session list items are tappable, navigate to review/live views
- [ ] Web (Vercel) still looks and works exactly the same
