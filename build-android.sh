#!/bin/bash
# Local Android build script — only needed if you want to build on your Mac
# For CI builds: just push to mediscribe-app branch — GitHub Actions handles it automatically

set -e

echo "🔨 Building Chartr Android APK..."

cd "$(dirname "$0")/frontend"

echo "📦 Installing dependencies..."
npm ci

echo "⚡ Building React app..."
VITE_API_URL=https://mediscribe-api.fly.dev npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync android

echo "🤖 Building APK..."
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "✅ Done! APK is at:"
echo "   frontend/android/$APK_PATH"
echo ""
echo "Send it to your OnePlus via WhatsApp/email/Drive and install."
