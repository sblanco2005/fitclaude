"""Workout service — business logic for workout operations."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import Workout, WorkoutExercise


async def get_user_workouts(
    db: AsyncSession,
    user_id: int,
    days_back: int = 30,
    workout_type: str | None = None,
) -> list[Workout]:
    query = (
        select(Workout)
        .where(
            Workout.user_id == user_id,
            Workout.date >= date.today() - timedelta(days=days_back),
        )
        .options(selectinload(Workout.exercises))
        .order_by(Workout.date.desc())
    )
    if workout_type:
        query = query.where(Workout.workout_type == workout_type)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_workout_by_id(db: AsyncSession, workout_id: int) -> Workout | None:
    result = await db.execute(
        select(Workout)
        .where(Workout.id == workout_id)
        .options(selectinload(Workout.exercises))
    )
    return result.scalar_one_or_none()


async def get_average_fatigue(
    db: AsyncSession, user_id: int, last_n: int = 3
) -> float | None:
    """Get average fatigue rating from the last N completed workouts."""
    result = await db.execute(
        select(Workout.fatigue_rating)
        .where(
            Workout.user_id == user_id,
            Workout.completed.is_(True),
            Workout.fatigue_rating.isnot(None),
        )
        .order_by(Workout.date.desc())
        .limit(last_n)
    )
    ratings = [r for (r,) in result.all() if r is not None]
    return sum(ratings) / len(ratings) if ratings else None
