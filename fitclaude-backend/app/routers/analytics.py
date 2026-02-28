"""Analytics insights endpoint — uses Claude to analyze workout data."""

import json
import logging
from datetime import datetime, timedelta, timezone

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import async_session
from app.models.user import User
from app.models.workout import Workout, WorkoutExercise
from app.services.usage_service import log_token_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

# Simple in-memory cache: userId+weekNumber → result
_insights_cache: dict[str, dict] = {}


def _get_week_key(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    iso = now.isocalendar()
    return f"{user_id}:{iso.year}-W{iso.week:02d}"


def _parse_set_logs(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [
            s for s in parsed
            if isinstance(s, dict)
            and isinstance(s.get("weight"), (int, float))
            and isinstance(s.get("reps"), (int, float))
        ]
    except (json.JSONDecodeError, TypeError):
        return []


@router.get("/insights")
async def get_insights(user_id: str = Query(...)):
    # Check cache
    cache_key = _get_week_key(user_id)
    if cache_key in _insights_cache:
        return _insights_cache[cache_key]

    async with async_session() as db:
        # Fetch last 14 days of completed workouts
        # Strip tzinfo — DB column is TIMESTAMP WITHOUT TIME ZONE
        since = (datetime.now(timezone.utc) - timedelta(days=14)).replace(tzinfo=None)

        result = await db.execute(
            select(Workout)
            .where(
                Workout.user_id == user_id,
                Workout.completed == True,
                Workout.date >= since,
            )
            .options(
                selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise)
            )
            .order_by(Workout.date.asc())
        )
        workouts = result.scalars().all()

        if len(workouts) < 2:
            return {
                "insights": "Need at least 2 completed workouts in the last 14 days to generate insights. Keep training!",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }

        # Fetch user profile
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        # Build compact workout summary
        workout_summary = []
        for w in workouts:
            total_volume = 0
            exercises = []
            for ex in w.exercises:
                logs = _parse_set_logs(ex.set_logs)
                ex_volume = sum(l["weight"] * l["reps"] for l in logs)
                max_weight = max((l["weight"] for l in logs), default=0)
                total_volume += ex_volume
                exercises.append({
                    "name": ex.exercise.name if ex.exercise else "Unknown",
                    "muscleGroup": ex.exercise.muscle_group if ex.exercise else "unknown",
                    "type": ex.exercise.exercise_type if ex.exercise else "unknown",
                    "setsLogged": len(logs),
                    "maxWeight": max_weight,
                    "volume": round(ex_volume),
                    "reps": [l["reps"] for l in logs],
                })
            workout_summary.append({
                "date": w.date.strftime("%Y-%m-%d"),
                "name": w.name or w.workout_type,
                "workoutType": w.workout_type,
                "durationMinutes": w.duration_minutes,
                "fatigueRating": w.fatigue_rating,
                "totalVolume": round(total_volume),
                "exercises": exercises,
            })

        # Build user profile string
        user_goal = user.fitness_goal if user else "not set"
        user_exp = user.experience_level if user else "not set"
        user_age = user.age if user else "not set"
        user_weight = (
            f"{round(user.weight_kg * 2.205)} lb"
            if user and user.weight_kg
            else "not set"
        )

    # Call Claude (outside db session — we only need the summary data)
    try:
        response = await client.messages.create(
            model=settings.agent_model,
            max_tokens=800,
            system=(
                "You are a strength training analyst for a fitness app. "
                "Analyze the user's recent lifting data and provide 3-5 concise, actionable insights. Focus on:\n"
                "- Plateau detection: exercises where weight hasn't increased across sessions\n"
                "- Deload recommendations if volume has been consistently high\n"
                "- Rep range effectiveness: which rep ranges are producing the most volume\n"
                "- Recovery patterns: correlating rest days between workouts with performance\n"
                "- Progressive overload trends: are they getting stronger?\n"
                "Be direct and specific. Reference actual exercise names and numbers from the data. "
                "Format as bullet points starting with a bold topic. "
                "Do NOT use motivational fluff or generic advice. Weights are in pounds (lb)."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"User profile:\n"
                    f"- Goal: {user_goal}\n"
                    f"- Experience: {user_exp}\n"
                    f"- Age: {user_age}\n"
                    f"- Weight: {user_weight}\n\n"
                    f"Recent workout data (last 14 days, {len(workout_summary)} sessions):\n"
                    f"{json.dumps(workout_summary, indent=2)}"
                ),
            }],
        )

        # Log token usage
        async with async_session() as usage_db:
            await log_token_usage(
                usage_db, user_id, "analytics", settings.agent_model, response.usage
            )
            await usage_db.commit()

        text = response.content[0].text if response.content and response.content[0].type == "text" else ""
        result_data = {
            "insights": text,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Cache for this week
        _insights_cache[cache_key] = result_data
        # Clean old entries for this user
        for key in list(_insights_cache.keys()):
            if key != cache_key and key.startswith(user_id):
                del _insights_cache[key]

        return result_data

    except Exception as e:
        logger.error(f"[analytics/insights] Claude API error: {e}")
        raise HTTPException(status_code=502, detail=str(e))
