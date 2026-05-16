// useNativeAudio.js
// Platform-aware audio hook for Android native.
//
// Strategy: getUserMedia works inside Android WebView once the app holds
// RECORD_AUDIO permission. We use the Capacitor microphone plugin only to
// trigger the Android permission dialog — after that the existing
// useAudioCapture (MediaRecorder + getUserMedia) handles everything unchanged.
// Zero backend changes required.

import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Microphone } from '@dimer47/capacitor-microphone'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { useAudioCapture } from './useAudioCapture'

const isNative = Capacitor.isNativePlatform()

export function useNativeAudio({ onChunk, isConnected }) {
  // On web: permission is always "ready" — skip native flow
  const [permissionReady, setPermissionReady] = useState(!isNative)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const keepAwakeActive = useRef(false)

  // Step 1: request RECORD_AUDIO permission via native API on first call
  useEffect(() => {
    if (!isNative) return

    Microphone.requestPermissions()
      .then((status) => {
        // PermissionStatus.microphone: 'granted' | 'denied' | 'prompt'
        if (status.microphone === 'granted') {
          setPermissionReady(true)
        } else {
          setPermissionDenied(true)
        }
      })
      .catch(() => {
        // Plugin unavailable — try getUserMedia directly (works on Android 9+)
        setPermissionReady(true)
      })
  }, [])

  // Step 2: keep screen awake while recording, release when done
  const audio = useAudioCapture({
    onChunk,
    isConnected: isConnected && permissionReady && !permissionDenied,
  })

  useEffect(() => {
    if (!isNative) return

    if (audio.micStatus === 'recording' && !keepAwakeActive.current) {
      KeepAwake.keepAwake().catch(() => {})
      keepAwakeActive.current = true
    } else if (audio.micStatus !== 'recording' && keepAwakeActive.current) {
      KeepAwake.allowSleep().catch(() => {})
      keepAwakeActive.current = false
    }
  }, [audio.micStatus])

  // Cleanup keep-awake on unmount
  useEffect(() => {
    return () => {
      if (keepAwakeActive.current) {
        KeepAwake.allowSleep().catch(() => {})
        keepAwakeActive.current = false
      }
    }
  }, [])

  // Surface permission-denied as a mic status override
  if (permissionDenied) {
    return {
      ...audio,
      micStatus: 'denied',
      errorMessage: 'Microphone permission denied. Go to Settings → Apps → MediScribe → Permissions → allow Microphone.',
    }
  }

  return audio
}
