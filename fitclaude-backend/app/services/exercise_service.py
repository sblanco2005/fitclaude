"""Exercise service — queries for exercise lookup and filtering."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exercise import Exercise, ExerciseVariation


async def get_exercises_by_muscle(
    db: AsyncSession,
    muscle_group: str,
    equipment_available: list[str] | None = None,
) -> list[Exercise]:
    """Get exercises for a muscle group, filtered by available equipment."""
    query = (
        select(Exercise)
        .where(Exercise.muscle_group == muscle_group)
        .options(selectinload(Exercise.variations))
    )
    result = await db.execute(query)
    exercises = result.scalars().all()

    if equipment_available is None:
        return list(exercises)

    # Filter: include bodyweight exercises (no equipment) and exercises
    # where all required equipment is available
    filtered = []
    equip_set = {e.lower() for e in equipment_available}
    for ex in exercises:
        if not ex.equipment_required:
            filtered.append(ex)
            continue
        required = {e.strip().lower() for e in ex.equipment_required.split(",")}
        if required.issubset(equip_set):
            filtered.append(ex)
    return filtered


async def get_all_exercises(db: AsyncSession) -> list[Exercise]:
    result = await db.execute(
        select(Exercise).options(selectinload(Exercise.variations))
    )
    return list(result.scalars().all())


async def search_exercises(db: AsyncSession, query: str) -> list[Exercise]:
    result = await db.execute(
        select(Exercise)
        .where(Exercise.name.ilike(f"%{query}%"))
        .options(selectinload(Exercise.variations))
    )
    return list(result.scalars().all())
