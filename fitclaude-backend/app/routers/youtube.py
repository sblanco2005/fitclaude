"""Build a routine from a YouTube workout video's transcript."""

import logging
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coach import generate_workout_from_youtube
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workouts", tags=["youtube"])


class YouTubeRoutineRequest(BaseModel):
    user_id: str
    youtube_url: str
    timezone: str | None = None


@router.post("/from-youtube")
async def from_youtube(request: YouTubeRoutineRequest, db: AsyncSession = Depends(get_db)):
    user_tz: ZoneInfo | None = None
    if request.timezone:
        try:
            user_tz = ZoneInfo(request.timezone)
        except Exception:
            user_tz = None
    try:
        return await generate_workout_from_youtube(
            db, request.user_id, request.youtube_url, user_tz=user_tz
        )
    except Exception as e:
        logger.error(f"[youtube] from-youtube failed: {type(e).__name__}: {e}", exc_info=True)
        return {"error": "Something went wrong reading that video. Please try again."}
