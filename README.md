# Chartr

**An ambient AI medical scribe for Indian doctors — listens to the consultation, writes the clinical note.**

[Live App](https://chartr-ai-eight.vercel.app) · [API Docs](https://chartr-api.fly.dev/docs) · [API Health](https://chartr-api.fly.dev/health)

---

## The Problem

Doctors in India spend **30–40% of consultation time** writing notes instead of looking at the patient.

A busy GP seeing 40 patients a day writes the same structure 40 times a day: chief complaint, history, vitals, examination findings, assessment, plan, ICD-10 code. By hand, every single time. The result is burnout, rushed documentation, missed details, and billing errors — and most commercial scribe tools are built for the US market, priced in dollars, and tuned for American accents and EHR formats, not Indian English, Indian drug names, or Indian clinic workflows.

## The Solution

Chartr listens to the doctor–patient conversation in real time, transcribes it with speaker separation (doctor vs. patient), and turns it into a structured, signable clinical note — before the patient leaves the room.

1. **Start a session** — doctor opens Chartr on any device, picks the patient, hits record.
2. **Consult normally** — Chartr transcribes live and diarizes speakers as the conversation happens.
3. **Review & sign** — a complete SOAP note (Subjective, Objective, Assessment, Plan) with suggested ICD-10 codes appears seconds after the consult ends, ready to edit, sign, and export.

No typing. No dictation. No template-filling. The doctor just talks.

### Try it

| | |
|---|---|
| **App** | https://chartr-ai-eight.vercel.app |
| **Demo login** | `ananya@demo.chartr.in` / `demo1234` |

The backend runs on a free-tier instance that sleeps when idle — the first request after a while may take ~15s to wake up.

---

## What It Actually Does (Shipped Features)

- **Real-time transcription** of the consultation via streaming ASR (Deepgram Nova-3, tuned for Indian English; Sarvam Saaras v3 integrated as a parallel/fallback provider)
- **Speaker diarization** — automatically attributes each line to doctor or patient
- **AI-generated SOAP notes** — structured clinical notes (LangChain + Perplexity `sonar-reasoning-pro` / `r1-1776`) produced directly from the transcript
- **ICD-10 code suggestions** generated alongside the note
- **Document generation** — SOAP note PDF, prescription PDF, and patient take-home instructions, all exportable in one click
- **Patient document analysis** — upload lab reports / scans, extract text (PyPDF) and analyze images with a vision model (Gemini 1.5 Flash) to give the AI clinical context
- **Multi-doctor clinics** — clinic admin accounts, doctor invites, per-clinic dashboards
- **Practice analytics** — OPD volume by day/weekday, ICD-10 breakdown, per-doctor breakdown, built entirely from existing session data with zero extra AI calls
- **Session history & transcript viewer** — every past consultation, transcript, and generated note is retrievable
- **Auth & security** — JWT-based auth (30-minute expiry), bcrypt password hashing, forgot/reset password flow with rate limiting, PIN-gated access for pre-launch sharing with pilot clinics
- **Billing** — subscription status, subscribe/cancel flow
- **DPDP-conscious data handling** — audio is not retained after processing; Redis session state is wiped after use; full audit logging of note access
- **Production deployment** — live on Vercel (frontend CDN) + Fly.io Mumbai (API) + Supabase Mumbai (Postgres) + Upstash Mumbai (Redis), all in-region for Indian data residency and low latency

## How It's Aiding Doctors in India

Chartr is built around real Indian OPD (outpatient department) workflows rather than adapting a US-first product:

- **Indian-accent ASR** — transcription tuned for Indian English speech patterns, with a second ASR provider (Sarvam, built for Indian languages) wired in as a fallback
- **Regional infrastructure** — database, cache, and API all run in Mumbai, keeping patient data in-country and latency low for Indian clinics
- **Clinic-scale workflow** — not a solo-doctor toy: supports clinics with multiple doctors, admin roles, and shared practice analytics
- **Cost-aware architecture** — backend scales to zero when idle (`./sleep.sh` / `./wake.sh`), keeping infrastructure cost near $0 for a pre-revenue pilot, which matters for a product aimed at price-sensitive Indian clinics rather than enterprise US hospital systems

## Why This Problem, Why Now

This project started as a direct observation: Indian doctors already using international AI scribes were paying US pricing for a product that mis-transcribed Indian names, Indian drug brands, and local clinical shorthand, and produced notes formatted for US billing codes. Chartr is an attempt to build the same category of product — ambient clinical documentation — correctly for the Indian market: regional ASR, regional infrastructure, regional pricing, and a workflow shaped around how Indian OPDs actually run (high patient volume, short consult times, multi-doctor clinics).

---

## Architecture

```
Browser (React 18 + Vite)
     │ HTTPS REST + WebSocket
     ▼
FastAPI backend (Python 3.12, Fly.io — Mumbai)
     │
     ├── Deepgram Nova-3 / Sarvam Saaras v3   → real-time ASR + diarization
     ├── LangChain → Perplexity (sonar-reasoning-pro / r1-1776) → SOAP note + ICD-10
     ├── Gemini 1.5 Flash                     → patient document / image analysis
     │
     ├── PostgreSQL (Supabase, Mumbai)        → sessions, notes, transcripts, patients, audit log
     └── Redis (Upstash, Mumbai)               → live session state, speaker maps, WS management
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Zustand, TanStack Query, Recharts |
| Backend | FastAPI, SQLAlchemy (async), Alembic, Pydantic Settings |
| Auth | JWT (`python-jose`), `passlib`/`bcrypt` |
| AI / ASR | Deepgram Nova-3, Sarvam Saaras v3, LangChain, Perplexity, Gemini 1.5 Flash |
| Data | PostgreSQL (Supabase), Redis (Upstash) |
| PDF / Docs | `fpdf2`, `pypdf`, Jinja2 |
| Infra | Docker, Fly.io (API), Vercel (frontend CDN), Supabase, Upstash |

---

## Running It Locally

### Prerequisites
- Docker Desktop (or Docker + Docker Compose v2)
- API keys for Deepgram/Sarvam, Perplexity (and optionally Gemini), via your own accounts

### Setup

```bash
git clone https://github.com/priyankvashisht11/MediscribeAi.git
cd MediscribeAi/mediscribe
cp .env.example .env
# edit .env with your own API keys — never commit this file

docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_demo.py   # optional demo data

# open http://localhost:3000
```

### Production-style deployment

```bash
cp .env.example .env   # fill in production values
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## Project Status

This is an actively developed solo project, built and shipped sprint-by-sprint — from an in-browser Docker Compose skeleton through live ASR, diarization, AI note generation, multi-doctor clinics, billing, and a production deployment on Vercel/Fly.io/Supabase/Upstash. It is currently in pilot with design-partner clinics in India.

## License

Proprietary — all rights reserved. Shared publicly as a portfolio/engineering showcase; not licensed for reuse or redistribution.
