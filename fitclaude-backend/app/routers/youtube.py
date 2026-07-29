"""Build a routine from pasted workout text (IG caption, transcript, write-up)."""

import logging
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coach import generate_workout_from_text, generate_workout_from_url
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workouts", tags=["routine-import"])


def _tz(name: str | None) -> ZoneInfo | None:
    if not name:
        return None
    try:
        return ZoneInfo(name)
    except Exception:
        return None


class TextRoutineRequest(BaseModel):
    user_id: str
    text: str
    timezone: str | None = None


class UrlRoutineRequest(BaseModel):
    user_id: str
    url: str
    timezone: str | None = None


@router.post("/from-text")
async def from_text(request: TextRoutineRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await generate_workout_from_text(db, request.user_id, request.text, user_tz=_tz(request.timezone))
    except Exception as e:
        logger.error(f"[from-text] failed: {type(e).__name__}: {e}", exc_info=True)
        return {"error": "Something went wrong reading that. Please try again."}


@router.post("/from-url")
async def from_url(request: UrlRoutineRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await generate_workout_from_url(db, request.user_id, request.url, user_tz=_tz(request.timezone))
    except Exception as e:
        logger.error(f"[from-url] failed: {type(e).__name__}: {e}", exc_info=True)
        return {"error": "Something went wrong reading that link. Please try again."}
