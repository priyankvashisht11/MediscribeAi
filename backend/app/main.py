from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import doctors, notes, sessions, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="MediScribe API",
    version="0.1.0",
    description="Ambient AI Medical Scribe — POC",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(notes.router, prefix="/api/notes", tags=["Notes"])
app.include_router(doctors.router, prefix="/api/doctors", tags=["Doctors"])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mediscribe-api"}
