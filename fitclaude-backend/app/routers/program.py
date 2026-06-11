"""Training Program API routes."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ProgramDay, TrainingProgram, Workout

router = APIRouter(prefix="/api/users/{user_id}/program", tags=["program"])

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Response schemas ─────────────────────────────────────────────────────────


class ProgramDayResponse(BaseModel):
    id: str
    weekday: int
    weekNumber: int
    dayType: str
    dayLabel: str
    workoutType: str | None = None
    exerciseTemplate: list | None = None

    model_config = {"from_attributes": True}


class ProgramResponse(BaseModel):
    id: str
    totalWeeks: int
    currentWeek: int
    isActive: bool
    days: list[ProgramDayResponse]

    model_config = {"from_attributes": True}


class TodayResponse(BaseModel):
    programDayId: str | None
    weekday: int
    weekdayName: str
    weekNumber: int
    dayType: str
    dayLabel: str
    workoutType: str | None = None
    exerciseTemplate: list | None = None
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
        totalWeeks=program.total_weeks,
        currentWeek=program.current_week,
        isActive=program.is_active,
        days=[
            ProgramDayResponse(
                id=d.id,
                weekday=d.weekday,
                weekNumber=d.week_number,
                dayType=d.day_type,
                dayLabel=d.day_label,
                workoutType=d.workout_type,
                exerciseTemplate=json.loads(d.exercise_template) if d.exercise_template else None,
            )
            for d in sorted(program.days, key=lambda d: (d.week_number, d.weekday))
        ],
    )


@router.delete("")
async def delete_program(user_id: str, db: AsyncSession = Depends(get_db)):
    """Delete the user's active training program.

    A user can now hold multiple programs (1 active + recreated ones), so this is
    scoped to the active program. Removing a specific non-active program is handled
    in the Next.js/Prisma layer.
    """
    result = await db.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id, TrainingProgram.is_active == True
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="No program found")

    await db.delete(program)
    await db.commit()
    return {"deleted": True}


@router.get("/today")
async def get_today(
    user_id: str, db: AsyncSession = Depends(get_db)
) -> TodayResponse | dict:
    """Get today's program day based on the current weekday + week."""
    result = await db.execute(
        select(TrainingProgram).where(
            TrainingProgram.user_id == user_id, TrainingProgram.is_active == True
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        return {"program": None}

    today_weekday = datetime.now(timezone.utc).weekday()

    day_result = await db.execute(
        select(ProgramDay).where(
            ProgramDay.program_id == program.id,
            ProgramDay.weekday == today_weekday,
            ProgramDay.week_number == program.current_week,
        )
    )
    current_day = day_result.scalar_one_or_none()

    if not current_day:
        # Default to rest if no entry exists for today
        return TodayResponse(
            programDayId=None,
            weekday=today_weekday,
            weekdayName=WEEKDAY_NAMES[today_weekday],
            weekNumber=program.current_week,
            dayType="rest",
            dayLabel="Rest",
        )

    template = (
        json.loads(current_day.exercise_template) if current_day.exercise_template else None
    )

    # Load last completed session for this program day (progressive overload reference)
    last_session_data = None
    if current_day.day_type == "coached":
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
        weekday=today_weekday,
        weekdayName=WEEKDAY_NAMES[today_weekday],
        weekNumber=program.current_week,
        dayType=current_day.day_type,
        dayLabel=current_day.day_label,
        workoutType=current_day.workout_type,
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
    """Update a program day (swap exercises, change label, etc.)."""
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
    if "dayLabel" in body:
        day.day_label = body["dayLabel"]
    if "dayType" in body:
        day.day_type = body["dayType"]
    if "workoutType" in body:
        day.workout_type = body["workoutType"]

    await db.commit()
    return {"updated": True}
