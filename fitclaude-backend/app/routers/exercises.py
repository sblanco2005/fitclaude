from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.jobs.video_linker import run_single_exercise_video_search
from app.schemas.exercise import ExerciseResponse
from app.services.exercise_service import get_all_exercises, search_exercises

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(db: AsyncSession = Depends(get_db)):
    return await get_all_exercises(db)


@router.get("/search", response_model=list[ExerciseResponse])
async def search(q: str, db: AsyncSession = Depends(get_db)):
    return await search_exercises(db, q)


@router.post("/{exercise_id}/search-videos")
async def search_videos_for_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Trigger YouTube video search for a specific exercise."""
    result = await run_single_exercise_video_search(db, exercise_id)
    return result
