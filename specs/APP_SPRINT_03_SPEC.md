# Sprint A3 — Native Microphone Recording

## Goal
Replace Web Audio API + MediaRecorder with Capacitor native audio recording. Audio streams to the backend WebSocket in real time. This is the most critical sprint — the core product feature must work on Android.

## The Problem
Web `MediaRecorder` + `getUserMedia` works fine in Chrome browser on Android but is unreliable inside a WebView (microphone permissions, background audio, codec support vary by device). We need Capacitor's native audio pipeline.

## Scope

### 1. Plugin: capacitor-voice-recorder
- `npm install capacitor-voice-recorder`
- `npx cap sync android`
- Handles: microphone permission request, recording start/stop, base64 audio output

### 2. Streaming approach
**Problem:** `capacitor-voice-recorder` records full clips, not a stream.  
**Solution:** Chunked recording loop:
- Record 3-second chunks in a loop while session is active
- Each chunk → base64 decode → send as binary blob over WebSocket
- Mimics the existing streaming behavior the backend expects

### 3. `useNativeAudio.js` hook
```js
// New hook — wraps capacitor-voice-recorder in a streaming loop
// Exposes: { startRecording, stopRecording, isRecording, error }
// On each chunk completion: sends blob to existing WebSocket connection
```

### 4. Platform switch in `ActiveSession.jsx`
```js
import { Capacitor } from '@capacitor/core'
const isNative = Capacitor.isNativePlatform()
// Use useNativeAudio if native, useSessionWs audio if web
```

### 5. Android permissions
- `AndroidManifest.xml`: `RECORD_AUDIO` permission already added by plugin
- Runtime permission request on first session start

### 6. Backend compatibility
- No backend changes — chunked blobs arrive the same as continuous stream
- Deepgram handles chunked audio fine (utterance_end events still fire)

## Out of Scope
- Background recording (app must stay foreground — acceptable for v1)
- Noise cancellation
- iOS

## Done When
- [ ] Microphone permission prompt appears on first session
- [ ] Recording starts, chunks sent to WebSocket every ~3s
- [ ] Transcript appears in real time in TranscriptViewer
- [ ] SOAP note generates at session end
- [ ] Works on physical Android device (not just emulator)

## Risk
- WebView WebSocket + native audio concurrency: test on real device early
