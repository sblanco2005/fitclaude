"""Spicy variation logic — the signature feature of FitClaude."""

import random

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise, ExerciseVariation

MODIFICATION_TYPES = {
    "tempo": {
        1: "Slow eccentric (3 sec down)",
        2: "3-1-3 tempo (3 down, 1 pause, 3 up)",
        3: "5 sec eccentric with 2 sec pause at bottom",
    },
    "grip": {
        1: "Wide grip variation",
        2: "Close grip variation",
        3: "Mixed grip or false grip",
    },
    "stance": {
        1: "Staggered stance",
        2: "Single leg / unilateral",
        3: "Deficit or elevated position",
    },
    "load_curve": {
        1: "Pause at midpoint",
        2: "1.5 reps (full + half rep = 1 rep)",
        3: "Mechanical drop set (hard angle to easy angle, no rest)",
    },
    "intensity": {
        1: "Last set to failure",
        2: "Drop set on final set",
        3: "Cluster sets (rest-pause: 5+4+3+2 with 15 sec rest)",
    },
}


async def get_spicy_variation(
    db: AsyncSession,
    exercise_name: str,
    spicy_level: int = 1,
) -> dict:
    """
    Get a spicy variation for an exercise.

    First checks the database for pre-defined variations.
    Falls back to generating one from the modification rules.
    """
    # Try database lookup
    exercise_result = await db.execute(
        select(Exercise).where(Exercise.name.ilike(f"%{exercise_name}%"))
    )
    exercise = exercise_result.scalar_one_or_none()

    if exercise:
        variation_result = await db.execute(
            select(ExerciseVariation)
            .where(
                ExerciseVariation.base_exercise_id == exercise.id,
                ExerciseVariation.spicy_level == spicy_level,
            )
            .order_by(func.random())
            .limit(1)
        )
        variation = variation_result.scalar_one_or_none()

        if variation:
            return {
                "base_exercise": exercise.name,
                "variation": variation.name,
                "spicy_level": variation.spicy_level,
                "type": variation.modification_type,
                "description": variation.description,
            }

    # Fallback: generate from rules
    mod_type = random.choice(list(MODIFICATION_TYPES.keys()))
    level = min(spicy_level, 3)

    return {
        "base_exercise": exercise_name,
        "variation": f"{exercise_name} ({MODIFICATION_TYPES[mod_type][level]})",
        "spicy_level": level,
        "type": mod_type,
        "description": MODIFICATION_TYPES[mod_type][level],
        "generated": True,
    }
