import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.jobs.video_linker import run_single_exercise_video_search
from app.schemas.exercise import (
    ExerciseResponse,
    IdentifyExerciseRequest,
    IdentifyExerciseResponse,
)
from app.services.exercise_service import get_all_exercises, search_exercises
from app.services.identify_service import identify_exercise

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(db: AsyncSession = Depends(get_db)):
    return await get_all_exercises(db)


@router.get("/search", response_model=list[ExerciseResponse])
async def search(q: str, db: AsyncSession = Depends(get_db)):
    return await search_exercises(db, q)


@router.post("/identify", response_model=IdentifyExerciseResponse)
async def identify_from_image(
    body: IdentifyExerciseRequest,
    db: AsyncSession = Depends(get_db),
):
    """Identify gym equipment from a photo and return matching exercises."""
    try:
        result = await identify_exercise(body.image_base64, body.image_media_type, db, target_muscle=body.target_muscle)
        return result
    except Exception as e:
        logger.exception("Exercise identification failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{exercise_id}/search-videos")
async def search_videos_for_exercise(
    exercise_id: str,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Trigger YouTube video search for a specific exercise.

    Pass ?force=true to dismiss pending videos and search again.
    """
    result = await run_single_exercise_video_search(db, exercise_id, force=force)
    return result
