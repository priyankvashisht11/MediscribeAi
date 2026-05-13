# MediScribe — Quick Reference Card

## What It Is
AI ambient medical scribe. Listens to doctor-patient consultation → generates SOAP note + ICD-10 codes → PDF export. Zero typing.

## Live Links

| Service | URL | Purpose |
|---------|-----|---------|
| **App (Frontend)** | https://mediscribe-ai-eight.vercel.app | What doctors use |
| **Backend API** | https://mediscribe-api.fly.dev | Business logic, AI orchestration |
| **API Health Check** | https://mediscribe-api.fly.dev/health | Verify backend is awake |
| **API Docs** | https://mediscribe-api.fly.dev/docs | Interactive Swagger UI |

## Infrastructure At a Glance

| Layer | Provider | Region |
|-------|----------|--------|
| Frontend | Vercel (CDN) | Global edge |
| Backend | Fly.io (Docker) | Mumbai (bom) |
| Database | Supabase (PostgreSQL) | Mumbai (ap-south-1) |
| Cache / Queues | Upstash (Redis) | Mumbai |

## Key AI Services

| Purpose | Service |
|---------|---------|
| Real-time transcription + diarization | Deepgram Nova-3 (en-IN) |
| SOAP note + ICD-10 generation | Perplexity sonar-reasoning-pro |

## Wake / Sleep (Cost Control)
```bash
./sleep.sh   # Scale Fly.io to 0 machines — $0 cost
./wake.sh    # Bring backend back — ~15s cold start
```
Vercel, Supabase, Upstash cost $0 when idle regardless.

## Sprint Status
- Sprint 7 complete: Deepgram live transcription + SOAP PDF export
- Sprint 8 pending: Clinical Documents + Analytics dashboard
