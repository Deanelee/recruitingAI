import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import create_tables
from routers import auth, resume, onboarding
from routers import jobs
from routers import applications

app = FastAPI(
    title="Recruiting AI Agent API",
    description="AI-powered recruiting agent that analyzes resumes and automates job applications",
    version="0.1.0",
)

# CORS: allow specific origins in production, wildcard in dev
_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw.split(",")] if _raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(onboarding.router)
app.include_router(jobs.router)
app.include_router(applications.router)


@app.on_event("startup")
async def startup_event():
    create_tables()


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Recruiting AI Agent API",
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    return {
        "message": "Welcome to Recruiting AI Agent API",
        "docs": "/docs",
        "health": "/health",
    }
