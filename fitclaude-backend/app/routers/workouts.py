from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.workout import WorkoutResponse
from app.services.workout_service import get_user_workouts, get_workout_by_id

router = APIRouter(prefix="/api/users/{user_id}/workouts", tags=["workouts"])


@router.get("", response_model=list[WorkoutResponse])
async def list_workouts(
    user_id: str,
    days_back: int = 30,
    workout_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    workouts = await get_user_workouts(db, user_id, days_back, workout_type)
    return workouts


@router.get("/{workout_id}", response_model=WorkoutResponse)
async def get_workout(
    user_id: str, workout_id: str, db: AsyncSession = Depends(get_db)
):
    workout = await get_workout_by_id(db, workout_id)
    if not workout or workout.user_id != user_id:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout
