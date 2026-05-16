#!/bin/bash
echo "⚔️  Waking Chartr..."
flyctl scale count 1 --app mediscribe-api --yes
echo "✅ Fly.io backend starting. Give it ~15s for first request."
echo "   Visit: https://mediscribe-ai-eight.vercel.app"
