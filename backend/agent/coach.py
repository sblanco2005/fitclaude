"""Coach agent orchestrator — handles the Claude API tool-use loop."""

import json
import uuid
from datetime import date, datetime, timedelta

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.agent.prompts import COACH_SYSTEM_PROMPT, build_user_context
from backend.agent.spicy import get_spicy_variation
from backend.services.youtube_service import import_exercises_from_youtube
from backend.agent.tools import TOOL_DEFINITIONS
from backend.config import settings
from backend.models import (
    ConversationHistory,
    NutritionLog,
    User,
    Workout,
    WorkoutExercise,
)

client = AsyncAnthropic(api_key=settings.anthropic_api_key)


async def _load_user_context(db: AsyncSession, user_id: str) -> dict:
    """Load user profile for context injection."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User {user_id} not found")

    return {
        "name": user.name,
        "fitness_goal": user.fitness_goal,
        "experience_level": user.experience_level,
        "gym_type": user.gym_type,
        "injuries_notes": user.injuries_notes,
        "equipment_text": user.equipment_text,
        "weight_kg": user.weight_kg,
        "daily_calorie_target": user.daily_calorie_target,
        "daily_protein_target": user.daily_protein_target,
    }


async def _load_conversation_history(
    db: AsyncSession, user_id: str, limit: int = 20
) -> list[dict]:
    """Load recent conversation history as messages array."""
    result = await db.execute(
        select(ConversationHistory)
        .where(ConversationHistory.user_id == user_id)
        .order_by(ConversationHistory.created_at.desc())
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    return [{"role": r.role, "content": r.content} for r in rows]


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """Execute a tool call and return the result."""
    if tool_name == "generate_workout":
        return await _tool_generate_workout(db, user_id, tool_input)
    elif tool_name == "log_nutrition":
        return await _tool_log_nutrition(db, user_id, tool_input)
    elif tool_name == "get_workout_history":
        return await _tool_get_workout_history(db, user_id, tool_input)
    elif tool_name == "get_daily_nutrition":
        return await _tool_get_daily_nutrition(db, user_id, tool_input)
    elif tool_name == "get_spicy_variation":
        return await get_spicy_variation(
            db,
            tool_input["exercise_name"],
            tool_input.get("spicy_level", 1),
        )
    elif tool_name == "mark_workout_complete":
        return await _tool_mark_workout_complete(db, tool_input)
    elif tool_name == "parse_youtube_video":
        return await import_exercises_from_youtube(db, tool_input["youtube_url"])
    elif tool_name == "log_workout_session":
        return await _tool_log_workout_session(db, user_id, tool_input)
    else:
        return {"error": f"Unknown tool: {tool_name}"}


async def _tool_generate_workout(
    db: AsyncSession, user_id: str, params: dict
) -> dict:
    """Create a workout record and return its structure."""
    now = datetime.utcnow()
    workout = Workout(
        id=str(uuid.uuid4()),
        user_id=user_id,
        workout_type=params["workout_type"],
        name=f"{params['workout_type'].replace('_', ' ').title()} Day",
        date=now,
        created_at=now,
    )
    db.add(workout)
    await db.flush()

    return {
        "workout_id": workout.id,
        "workout_type": workout.workout_type,
        "name": workout.name,
        "message": (
            f"Workout #{workout.id} created. The user has the following equipment — "
            "select exercises accordingly. Present the workout with sets x reps format."
        ),
    }


async def _tool_log_nutrition(
    db: AsyncSession, user_id: str, params: dict
) -> dict:
    """Log a nutrition entry."""
    now = datetime.utcnow()
    log = NutritionLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        date=now,
        meal_type=params.get("meal_type"),
        raw_input=params["raw_text"],
        calories=params.get("calories"),
        protein_g=params.get("protein_g"),
        carbs_g=params.get("carbs_g"),
        fat_g=params.get("fat_g"),
        fiber_g=params.get("fiber_g"),
        created_at=now,
    )
    db.add(log)
    await db.flush()

    # Get daily totals
    daily = await _get_daily_totals(db, user_id, now)

    return {
        "nutrition_log_id": log.id,
        "logged": {
            "raw_input": log.raw_input,
            "calories": log.calories,
            "protein_g": log.protein_g,
            "carbs_g": log.carbs_g,
            "fat_g": log.fat_g,
        },
        "daily_totals": daily,
    }


async def _tool_get_workout_history(
    db: AsyncSession, user_id: str, params: dict
) -> dict:
    """Get recent workout history."""
    days_back = params.get("days_back", 14)
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    query = (
        select(Workout)
        .where(Workout.user_id == user_id, Workout.date >= cutoff)
        .options(selectinload(Workout.exercises))
        .order_by(Workout.date.desc())
    )
    if params.get("workout_type"):
        query = query.where(Workout.workout_type == params["workout_type"])

    result = await db.execute(query)
    workouts = result.scalars().all()

    return {
        "workouts": [
            {
                "id": w.id,
                "date": str(w.date),
                "type": w.workout_type,
                "name": w.name,
                "completed": w.completed,
                "fatigue_rating": w.fatigue_rating,
                "exercise_count": len(w.exercises),
            }
            for w in workouts
        ],
        "count": len(workouts),
    }


async def _tool_get_daily_nutrition(
    db: AsyncSession, user_id: str, params: dict
) -> dict:
    """Get nutrition totals for a date."""
    target_date = datetime.utcnow()
    if params.get("date"):
        target_date = datetime.fromisoformat(params["date"])

    return await _get_daily_totals(db, user_id, target_date)


async def _get_daily_totals(
    db: AsyncSession, user_id: str, target: datetime | date
) -> dict:
    """Helper to aggregate daily nutrition totals."""
    # Normalize to a date so we can build a day range
    if isinstance(target, datetime):
        day = target.date()
    else:
        day = target
    day_start = datetime(day.year, day.month, day.day)
    day_end = datetime(day.year, day.month, day.day, 23, 59, 59)

    result = await db.execute(
        select(NutritionLog).where(
            NutritionLog.user_id == user_id,
            NutritionLog.date >= day_start,
            NutritionLog.date <= day_end,
        )
    )
    logs = result.scalars().all()

    return {
        "date": str(day),
        "total_calories": sum(l.calories or 0 for l in logs),
        "total_protein_g": sum(l.protein_g or 0 for l in logs),
        "total_carbs_g": sum(l.carbs_g or 0 for l in logs),
        "total_fat_g": sum(l.fat_g or 0 for l in logs),
        "meal_count": len(logs),
    }


async def _tool_mark_workout_complete(db: AsyncSession, params: dict) -> dict:
    """Mark a workout as completed."""
    result = await db.execute(
        select(Workout).where(Workout.id == params["workout_id"])
    )
    workout = result.scalar_one_or_none()
    if not workout:
        return {"error": f"Workout {params['workout_id']} not found"}

    workout.completed = True
    workout.fatigue_rating = params["fatigue_rating"]
    if params.get("notes"):
        workout.notes = params["notes"]
    await db.flush()

    return {
        "workout_id": workout.id,
        "completed": True,
        "fatigue_rating": workout.fatigue_rating,
    }


async def _tool_log_workout_session(
    db: AsyncSession, user_id: str, params: dict
) -> dict:
    """Log a completed workout session from quick-log shorthand."""
    now = datetime.utcnow()
    workout = Workout(
        id=str(uuid.uuid4()),
        user_id=user_id,
        workout_type=params["workout_type"],
        name=params.get("workout_name") or f"{params['workout_type'].replace('_', ' ').title()} Session",
        date=now,
        duration_minutes=params.get("duration_minutes"),
        notes=params.get("notes"),
        completed=True,
        created_at=now,
    )
    db.add(workout)
    await db.flush()

    for i, ex in enumerate(params.get("exercises", [])):
        db.add(WorkoutExercise(
            id=str(uuid.uuid4()),
            workout_id=workout.id,
            order=i + 1,
            sets=ex["sets"],
            reps=str(ex.get("reps", "")),
            weight_kg=ex.get("weight_kg"),
            notes=ex.get("name"),  # store exercise name in notes when no exerciseId
            was_spicy=False,
        ))

    await db.flush()

    return {
        "workout_id": workout.id,
        "logged": {
            "name": workout.name,
            "type": workout.workout_type,
            "exercises_count": len(params.get("exercises", [])),
            "completed": True,
        },
        "message": (
            f"Logged {len(params.get('exercises', []))} exercise(s) as a completed "
            f"{workout.workout_type} session. Confirm with the user and optionally ask "
            "for a fatigue rating."
        ),
    }


async def handle_chat(
    user_id: str,
    user_message: str,
    db: AsyncSession,
    image_base64: str | None = None,
    image_media_type: str | None = None,
) -> dict:
    """
    Main agent entry point.

    Handles the full tool-use loop: sends user message to Claude,
    executes any tool calls, sends results back, repeats until
    Claude returns a text response.
    """
    # Load context
    user_data = await _load_user_context(db, user_id)
    context = build_user_context(user_data)
    history = await _load_conversation_history(db, user_id)

    # Build user content — text only, or text + image for vision
    if image_base64 and image_media_type:
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type,
                    "data": image_base64,
                },
            },
            {"type": "text", "text": user_message},
        ]
    else:
        user_content = user_message

    # Build messages
    messages = history + [{"role": "user", "content": user_content}]

    # Call Claude
    response = await client.messages.create(
        model=settings.agent_model,
        max_tokens=1024,
        system=COACH_SYSTEM_PROMPT + "\n" + context,
        messages=messages,
        tools=TOOL_DEFINITIONS,
    )

    # Tool-use loop
    workout_id = None
    nutrition_log_id = None

    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await _execute_tool(block.name, block.input, user_id, db)
                # Track IDs for response
                if "workout_id" in result:
                    workout_id = result["workout_id"]
                if "nutrition_log_id" in result:
                    nutrition_log_id = result["nutrition_log_id"]

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

        response = await client.messages.create(
            model=settings.agent_model,
            max_tokens=1024,
            system=COACH_SYSTEM_PROMPT + "\n" + context,
            messages=messages,
            tools=TOOL_DEFINITIONS,
        )

    # Extract final text
    assistant_text = "".join(
        block.text for block in response.content if hasattr(block, "text")
    )

    # Save conversation history
    now = datetime.utcnow()
    db.add(ConversationHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        role="user",
        content=user_message,
        created_at=now,
    ))
    db.add(ConversationHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        role="assistant",
        content=assistant_text,
        created_at=now,
    ))
    await db.commit()

    return {
        "response": assistant_text,
        "workout_id": workout_id,
        "nutrition_log_id": nutrition_log_id,
    }
