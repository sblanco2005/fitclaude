from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.exercise import ExerciseResponse
from app.services.exercise_service import get_all_exercises, search_exercises

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(db: AsyncSession = Depends(get_db)):
    return await get_all_exercises(db)


@router.get("/search", response_model=list[ExerciseResponse])
async def search(q: str, db: AsyncSession = Depends(get_db)):
    return await search_exercises(db, q)
