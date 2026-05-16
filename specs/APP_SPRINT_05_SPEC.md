# Sprint A5 — Active Session Screen (Mobile Recording UX)

## Goal
The session recording screen is redesigned for mobile — large record button, live transcript scrolling, visual audio indicator. This is the screen doctors will use 20× per day. It must feel fast and reliable.

## Scope

### 1. `ActiveSession.jsx` mobile layout
- Full screen, no sidebar/header clutter
- Top bar: patient name + session timer (HH:MM:SS)
- Center: large pulsing record button (80px, teal → red when recording)
- Bottom: scrollable live transcript (last 5 utterances visible, auto-scroll)
- "End Session" button — prominent, red, above safe area

### 2. Recording button states
```
IDLE      → teal mic icon, "Tap to Start"
RECORDING → red pulsing circle, "Recording..." + timer
STOPPING  → spinner, "Finalizing..."
DONE      → green check, navigates to NoteReview
```

### 3. Audio waveform indicator
- Simple CSS animation: 5 bars that animate height during recording
- Shows audio is being captured (not a real waveform — just visual feedback)
- Stops animating when no audio detected

### 4. Live transcript display (mobile)
- Each utterance: speaker label (Doctor / Patient) + text
- Doctor utterances: right-aligned, teal
- Patient utterances: left-aligned, grey
- Auto-scroll to bottom as new utterances arrive

### 5. Screen wake lock
- `npm install @capacitor/keep-awake`
- Acquire wake lock on recording start, release on stop
- Prevents screen sleep during 10-minute consultations

### 6. Background audio warning
- If app goes to background during recording: local notification "Recording paused — tap to resume"
- `npm install @capacitor/local-notifications`

## Out of Scope
- Real audio waveform (FFT) — too expensive for v1
- Speaker diarization UI toggle

## Done When
- [ ] Record button starts/stops correctly via native audio (Sprint A3 hook)
- [ ] Transcript updates live as words arrive from WebSocket
- [ ] Screen stays on during recording
- [ ] Background notification fires if app backgrounded
- [ ] End Session → SOAP note generates → navigates to NoteReview
