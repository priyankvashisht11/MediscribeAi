# MediScribe — Production Status Report
**Date:** 13 May 2026
**Status:** LIVE ✅

---

## Deployment Architecture

```
User Browser
     │
     ▼
┌─────────────────────────────────┐
│  Vercel CDN (Global Edge)       │
│  https://mediscribe-ai-eight    │
│  .vercel.app                    │
│  React 18 + Vite, SPA           │
│  Framework: Vite + React Router │
└─────────────┬───────────────────┘
              │ HTTPS REST + WSS
              ▼
┌─────────────────────────────────┐
│  Fly.io — Mumbai (bom)          │
│  https://mediscribe-api.fly.dev │
│  FastAPI + Python 3.12          │
│  Docker, 512MB RAM, 1 shared CPU│
│  auto_stop: ON (sleeps at idle) │
│  max machines: 1                │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌────────────┐  ┌─────────────────┐
│ Supabase   │  │ Upstash Redis   │
│ PostgreSQL │  │ Mumbai edge     │
│ Mumbai     │  │ Session state   │
│ (ap-south-1│  │ WebSocket mgmt  │
│ pooler)    │  │ Pay-per-request │
└────────────┘  └─────────────────┘
       │
       ▼ (external AI calls)
┌────────────────────────────────────────┐
│ Deepgram Nova-3 (en-IN)                │
│ Real-time ASR + speaker diarization    │
│ WebSocket stream from backend          │
├────────────────────────────────────────┤
│ Perplexity sonar-reasoning-pro         │
│ SOAP note generation + ICD-10 codes    │
│ REST call, triggered on session end    │
└────────────────────────────────────────┘
```

---

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Doctor profiles | ✅ Live | 5 mock doctors seeded at startup |
| New session creation | ✅ Live | Patient name, doctor selection |
| Real-time transcription | ✅ Live | Deepgram Nova-3 en-IN via WebSocket |
| Speaker diarization | ✅ Live | Doctor vs. patient separation built-in |
| Session end + note trigger | ✅ Live | Auto-triggers Perplexity on end |
| SOAP note generation | ✅ Live | sonar-reasoning-pro, structured output |
| ICD-10 code suggestions | ✅ Live | Included in note generation prompt |
| Note review + edit | ✅ Live | Section-by-section editing |
| Note finalization / sign | ✅ Live | Locks note, audit log entry |
| PDF export | ✅ Live | Clinic-branded, ReportLab |
| Session history | ✅ Live | Filterable by doctor, date, status |
| Transcript viewer | ✅ Live | Speaker-labeled chunks |
| Settings / health check | ✅ Live | Shows Deepgram + DB + Redis status |
| Active sessions monitor | ✅ Live | Polling every 10s |

---

## Infrastructure Health

| Service | Status | Cost Model |
|---------|--------|------------|
| Vercel (frontend) | ✅ Active | Free (Hobby) — $0/month |
| Fly.io (backend) | ✅ Active (sleeps at idle) | ~$0–3/month with auto_stop |
| Supabase (DB) | ✅ Active | Free tier — $0/month |
| Upstash (Redis) | ✅ Active | Free tier — $0/month |
| Deepgram | ✅ Configured | Pay-per-second of audio transcribed |
| Perplexity | ✅ Configured | Pay-per-token of note generated |

**Estimated monthly cost at near-zero usage: $0**
**Estimated monthly cost at 100 sessions/day: ~$15–25**

---

## Known Limitations (Pre-Sprint 8)

1. **No authentication** — anyone with the URL can use the app. Suitable for demo only, not for real patient data.
2. **No multi-tenancy** — all doctors share one database. No clinic isolation.
3. **ICD-10 codes depend on conversation length** — short demo sessions (<1 min) may return "None suggested."
4. **Cold start latency** — first request after idle takes ~8–15 seconds (Fly.io machine spins up).
5. **No analytics dashboard** — planned for Sprint 8.
6. **No document templates** — prescriptions, referral letters planned for Sprint 8.

---

## Codebase

| Location | Repository |
|----------|------------|
| GitHub | https://github.com/priyankvashisht11/MediscribeAi |
| Branch | `main` |
| Backend path | `mediscribe/backend/` |
| Frontend path | `mediscribe/frontend/` |

---

## Sprint History

| Sprint | Focus | Status |
|--------|-------|--------|
| 1–3 | Core architecture, DB models, session CRUD | ✅ Done |
| 4–5 | WebSocket, real-time audio pipeline | ✅ Done |
| 6 | Perplexity SOAP generation, ICD-10, PDF | ✅ Done |
| 7 | Deepgram Nova-3, speaker diarization, UI polish | ✅ Done |
| 8 | Clinical Documents + Analytics | 🔲 Planned |

---

## Next Steps (Sprint 8 — Planned)

- Prescription pad (template → PDF)
- Referral letter generator
- Analytics dashboard (sessions per day, avg confidence, top diagnoses)
- Basic authentication (clinic login)
- Audit trail improvements
