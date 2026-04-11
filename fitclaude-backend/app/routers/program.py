"""Training Program API routes."""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ProgramDay, TrainingProgram, Workout, WorkoutExercise

router = APIRouter(prefix="/api/users/{user_id}/program", tags=["program"])


# ── Response schemas ─────────────────────────────────────────────────────────


class ProgramDayResponse(BaseModel):
    id: str
    dayLabel: str
    workoutType: str
    dayIndex: int
    exerciseTemplate: list  # parsed JSON

    model_config = {"from_attributes": True}


class ProgramResponse(BaseModel):
    id: str
    splitType: str
    rotation: list  # parsed JSON
    currentDayIndex: int
    isActive: bool
    days: list[ProgramDayResponse]

    model_config = {"from_attributes": True}


class TodayResponse(BaseModel):
    programDayId: str
    dayLabel: str
    workoutType: str
    dayIndex: int
    exerciseTemplate: list
    isRestDay: bool = False
    lastSession: dict | None = None


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("")
async def get_program(
    user_id: str, db: AsyncSession = Depends(get_db)
) -> ProgramResponse | dict:
    """Get the user's active training program."""
    result = await db.execute(
        select(TrainingProgram)
        .where(TrainingProgram.user_id == user_id, TrainingProgram.is_active == True)
        .options(selectinload(TrainingProgram.days))
    )
    program = result.scalar_one_or_none()
    if not program:
        return {"program": None}

    return ProgramResponse(
        id=program.id,
        splitType=program.split_type,
        rotation=json.loads(program.rotation),
        currentDayIndex=program.current_day_index,
        isActive=program.is_active,
        days=[
            ProgramDayResponse(
                id=d.id,
                dayLabel=d.day_label,
                workoutType=d.workout_type,
                dayIndex=d.day_index,
                exerciseTemplate=json.loads(d.exercise_template),
            )
            for d in sorted(program.days, key=lambda d: d.day_index)
        ],
    )


@router.delete("")
async def delete_program(user_id: str, db: AsyncSession = Depends(get_db)):
    """Deactivate the user's training program."""
    result = await db.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id, TrainingProgram.is_active == True
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="No active program found")

    program.is_active = False
    await db.commit()
    return {"deleted": True}


@router.get("/today")
async def get_today(
    user_id: str, db: AsyncSession = Depends(get_db)
) -> TodayResponse | dict:
    """Get today's workout from the training program rotation."""
    result = await db.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id, TrainingProgram.is_active == True
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        return {"program": None}

    rotation = json.loads(program.rotation)
    if not rotation:
        return {"program": None}

    # Get current day
    day_result = await db.execute(
        select(ProgramDay).where(
            ProgramDay.program_id == program.id,
            ProgramDay.day_index == program.current_day_index,
        )
    )
    current_day = day_result.scalar_one_or_none()
    if not current_day:
        return {"program": None}

    template = json.loads(current_day.exercise_template)

    # Load last completed session for this program day
    last_session_data = None
    last_result = await db.execute(
        select(Workout)
        .where(
            Workout.program_day_id == current_day.id,
            Workout.completed == True,
        )
        .options(selectinload(Workout.exercises))
        .order_by(Workout.date.desc())
        .limit(1)
    )
    last_workout = last_result.scalar_one_or_none()
    if last_workout:
        exercises_data = []
        for we in sorted(last_workout.exercises, key=lambda e: e.order):
            name = we.notes.split("|")[0] if we.notes and "|" in we.notes else "?"
            exercises_data.append({
                "name": name,
                "sets": we.sets,
                "reps": we.reps,
                "weight": we.weight_kg,
                "setLogs": we.set_logs,
            })
        last_session_data = {
            "date": last_workout.date.isoformat() if last_workout.date else None,
            "fatigueRating": last_workout.fatigue_rating,
            "exercises": exercises_data,
        }

    return TodayResponse(
        programDayId=current_day.id,
        dayLabel=current_day.day_label,
        workoutType=current_day.workout_type,
        dayIndex=current_day.day_index,
        exerciseTemplate=template,
        lastSession=last_session_data,
    )


@router.patch("/days/{day_id}")
async def update_program_day(
    user_id: str,
    day_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update a program day's exercise template (for swaps)."""
    result = await db.execute(
        select(ProgramDay)
        .join(TrainingProgram)
        .where(
            ProgramDay.id == day_id,
            TrainingProgram.user_id == user_id,
        )
    )
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Program day not found")

    if "exerciseTemplate" in body:
        day.exercise_template = json.dumps(body["exerciseTemplate"])

    await db.commit()
    return {"updated": True}
