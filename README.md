# MediScribe POC

AI-assisted clinical documentation for Indian medical practitioners.

Stack: React (Vite) · FastAPI · PostgreSQL (pgvector) · Redis · faster-whisper · pyannote · Perplexity r1-1776

---

## Quick Start (Development)

### Prerequisites
- Docker Desktop (or Docker + Docker Compose v2)
- A `.env` file — copy from `.env.example` and fill in:
  - `PERPLEXITY_API_KEY` — get from https://www.perplexity.ai/settings/api
  - `HF_TOKEN` — Hugging Face token with access to pyannote/speaker-diarization-3.1

### 1. Clone and configure
    git clone <repo>
    cd mediscribe
    cp .env.example .env
    # Edit .env — add PERPLEXITY_API_KEY and HF_TOKEN

### 2. Start services
    docker compose up --build

### 3. Run database migrations
    docker compose exec backend alembic upgrade head

### 4. Seed demo data (optional but recommended)
    docker compose exec backend python scripts/seed_demo.py

### 5. Open the app
    http://localhost:3000

---

## Production Deployment

    cp .env.example .env
    # Edit .env for production values
    docker compose -f docker-compose.prod.yml up -d --build
    docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
    docker compose -f docker-compose.prod.yml exec backend python scripts/seed_demo.py
    # App available at http://localhost (port 80)

---

## Architecture

    Browser (React + Vite)
        ↕ HTTP/REST     → FastAPI (port 8000)
        ↕ WebSocket     → FastAPI WS handler
                              ↓
                         faster-whisper (ASR)
                         pyannote (diarization)
                         Perplexity r1-1776 (SOAP generation)
                              ↓
                         PostgreSQL (sessions, notes, transcripts, audit)
                         Redis (live session state, speaker maps)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| N   | New Session |
| H   | Session History |
| D   | Dashboard |
| ?   | Show all shortcuts |
| Esc | Close modal |

---

## Sprints Completed

| Sprint | Focus |
|--------|-------|
| 0 | Monorepo, Docker Compose, FastAPI skeleton, PostgreSQL schema |
| 1 | Real-time ASR (faster-whisper), WebSocket audio pipeline |
| 2 | Speaker diarization (pyannote), doctor/patient attribution |
| 3 | LangChain SOAP note generation (Perplexity r1-1776) |
| 4 | Real dashboard data, session history, doctors page |
| 5 | DPDP compliance (audio cleanup, Redis wipe), PDF export, audit log |
| 6 | Settings, auth stub, transcript viewer, mobile responsiveness |
| 7 | Demo data, first-run UX, keyboard shortcuts, production Compose |
