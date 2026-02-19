"""Seed the database with exercises and variations from exercises.json."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from backend.database import async_session, init_db
from backend.models.exercise import Exercise, ExerciseVariation


async def seed():
    await init_db()

    seed_file = Path(__file__).parent / "exercises.json"
    with open(seed_file) as f:
        data = json.load(f)

    async with async_session() as db:
        for ex_data in data["exercises"]:
            # Check if exercise already exists
            result = await db.execute(
                select(Exercise).where(Exercise.name == ex_data["name"])
            )
            if result.scalar_one_or_none():
                continue

            exercise = Exercise(
                name=ex_data["name"],
                muscle_group=ex_data["muscle_group"],
                secondary_muscles=ex_data.get("secondary_muscles"),
                equipment_required=ex_data.get("equipment_required"),
                difficulty=ex_data.get("difficulty", "intermediate"),
                exercise_type=ex_data["exercise_type"],
                instructions=ex_data.get("instructions"),
            )
            db.add(exercise)
            await db.flush()

            for var_data in ex_data.get("variations", []):
                variation = ExerciseVariation(
                    base_exercise_id=exercise.id,
                    name=var_data["name"],
                    spicy_level=var_data["spicy_level"],
                    modification_type=var_data["modification_type"],
                    description=var_data["description"],
                    additional_equipment=var_data.get("additional_equipment"),
                )
                db.add(variation)

        await db.commit()
        print(f"Seeded {len(data['exercises'])} exercises with variations.")


if __name__ == "__main__":
    asyncio.run(seed())
