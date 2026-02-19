import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, exercises, nutrition, users, workouts

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="FitClaude API",
    description="AI-powered fitness coach",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(users.router)
app.include_router(workouts.router)
app.include_router(nutrition.router)
app.include_router(exercises.router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": "FitClaude"}
