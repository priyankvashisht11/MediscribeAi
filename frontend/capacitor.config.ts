import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.chartr',
  appName: 'Chartr',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // In development: point to your local backend
    // In production build: the app uses the Fly.io URL via env vars (VITE_API_URL)
    // No hardcoded URL here — Vite injects it at build time
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#016c72',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#016c72',
      showSpinner: false,
    },
  },
}

export default config
