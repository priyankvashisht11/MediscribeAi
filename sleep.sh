#!/bin/bash
echo "💤 Putting MediScribe to sleep..."
flyctl scale count 0 --app mediscribe-api --yes
echo "✅ Fly.io backend stopped. No machines running = zero cost."
echo "   Vercel, Supabase, Upstash are already idle-free."
echo "   Run ./wake.sh to bring it back."
