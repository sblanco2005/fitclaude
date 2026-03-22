"""Coach agent orchestrator — handles the Claude API tool-use loop."""

import json
import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone as tz
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

from anthropic import APIConnectionError, APIStatusError, AsyncAnthropic
from cuid2 import Cuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.workout.prompts import COACH_SYSTEM_PROMPT, build_user_context
from app.agents import nutrition_agent, vision_nutrition_agent
from app.router import detect_food_logging_intent
from app.agents.workout.spicy import get_spicy_variation
from app.services.youtube_service import import_exercises_from_youtube
from app.jobs.video_linker import _link_best_video
from app.agents.workout.tools import TOOL_DEFINITIONS
from app.agents.minimax_fallback import handle_chat_minimax
from app.config import settings
from app.services.usage_service import check_rate_limit, get_model_for_tier, log_token_usage
from app.models import (
    Activity,
    ConversationHistory,
    Exercise,
    NutritionLog,
    User,
    Workout,
    WorkoutExercise,
)
from app.models.exercise_video import ExerciseVideo
# Note: ConversationHistory is still imported for _load_conversation_history reads,
# but conversation saving is handled by the Next.js API route (Prisma).

client = AsyncAnthropic(api_key=settings.anthropic_api_key)
cuid_generator = Cuid()


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
        "carbs_percent": user.carbs_percent,
        "fat_percent": user.fat_percent,
    }


HISTORY_LIMITS: dict[str, int] = {
    "nutrition": 8,   # Nutrition logs are short, don't need much context
    "workout": 14,    # Workout generation needs more context for progressive overload
}


async def _load_conversation_history(
    db: AsyncSession, user_id: str, topic: str = "workout", limit: int | None = None
) -> list[dict]:
    """Load recent conversation history filtered by topic.
    Uses tiered limits per topic to reduce input tokens."""
    effective_limit = limit if limit is not None else HISTORY_LIMITS.get(topic, 10)
    result = await db.execute(
        select(ConversationHistory)
        .where(
            ConversationHistory.user_id == user_id,
            ConversationHistory.topic == topic,
        )
        .order_by(ConversationHistory.created_at.desc())
        .limit(effective_limit)
    )
    rows = list(reversed(result.scalars().all()))
    # Filter out messages with empty content — can happen when user sends image-only
    return [{"role": r.role, "content": r.content} for r in rows if r.content]


async def _execute_tool(
    tool_name: str,
    tool_input: dict,
    user_id: str,
    db: AsyncSession,
    user_tz: ZoneInfo | None = None,
) -> dict:
    """Execute a tool call and return the result."""
    if tool_name == "generate_workout":
        return await _tool_generate_workout(db, user_id, tool_input, user_tz=user_tz)
    elif tool_name == "log_nutrition":
        return await _tool_log_nutrition(db, user_id, tool_input, user_tz=user_tz)
    elif tool_name == "get_workout_history":
        return await _tool_get_workout_history(db, user_id, tool_input, user_tz=user_tz)
    elif tool_name == "get_daily_nutrition":
        return await _tool_get_daily_nutrition(db, user_id, tool_input, user_tz=user_tz)
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
    elif tool_name == "log_activity":
        return await _tool_log_activity(db, user_id, tool_input, user_tz=user_tz)
    elif tool_name == "log_routine_done":
        return await _tool_log_routine_done(db, user_id, tool_input, user_tz=user_tz)
    else:
        return {"error": f"Unknown tool: {tool_name}"}


import re


# Keywords that suggest the user is describing food to log
_FOOD_LOG_KEYWORDS = re.compile(
    r"\b(ate|had|log|ate|eaten|drank|drinking|eating|burger|chicken|rice|eggs?|"
    r"shake|protein|banana|oats|yogurt|steak|jerky|cheese|bread|pasta|pizza|"
    r"salad|fish|salmon|tuna|burrito|wrap|sandwich|cereal|milk|coffee|juice|"
    r"nurri|oikos|kirkland|costco|meal|snack|breakfast|lunch|dinner|"
    r"\d+\s*(?:g|oz|cup|piece|strip|serving|scoop))\b",
    re.IGNORECASE,
)


def _looks_like_food_log(message: str) -> bool:
    """Heuristic: does the user message look like they're describing food to log?"""
    return bool(_FOOD_LOG_KEYWORDS.search(message))


# Keywords that suggest the user wants a new workout generated
_WORKOUT_GEN_KEYWORDS = re.compile(
    r"\b(generate|create|make|build|give me|new workout|new routine|spin|replace|"
    r"different exercises|fresh routine|remix|regenerate|another workout|"
    r"new .{0,20} workout|workout with \d+ exercises|"
    r"i did|log this|log my|this morning|this routine|can you log)\b",
    re.IGNORECASE,
)


def _looks_like_workout_request(message: str) -> bool:
    """Heuristic: does the user message look like they want a workout generated?"""
    return bool(_WORKOUT_GEN_KEYWORDS.search(message))


# ─── Parse exercises from assistant text (fallback when Haiku skips tool) ─────

# Pattern A: "Exercise Name — 4 × 8-10 reps (2 min rest)" (weight-lifting style)
_EXERCISE_LINE_RE = re.compile(
    r"^[ \t]*"
    r"(?:\d+\.\s+)?"                              # optional "1. "
    r"\*{0,2}"                                     # optional bold **
    r"([A-Z][A-Za-z \-(),.]{2,55}?)"               # exercise name (2-55 chars, no newlines)
    r"\*{0,2}"                                     # optional bold **
    r"\s*[—–-]\s*"                                 # dash separator
    r"(\d+)\s*[×xX]\s*"                            # sets
    r"([\d\-]+)"                                   # reps
    r"(?:\s*(?:reps?|per\s+(?:leg|side)))?"        # optional "reps" / "per leg"
    r"(?:[^(\n]*\((\d+(?:\.\d+)?)\s*(min|sec|s)\s*rest\))?"  # optional rest with unit (supports decimals)
    ,
    re.MULTILINE,
)

# Pattern B: "Exercise Name — Description text." (HIIT / cardio / circuit style)
# Matches lines with a dash separator followed by descriptive text (not sets×reps).
_EXERCISE_DESC_LINE_RE = re.compile(
    r"^[ \t]*"
    r"(?:\d+\.\s+)?"                              # optional "1. "
    r"\*{0,2}"                                     # optional bold **
    r"([A-Z][A-Za-z \-(),.]{2,55}?)"               # exercise name
    r"\*{0,2}"                                     # optional bold **
    r"\s*[—–-]\s*"                                 # dash separator
    r"([A-Z][^\n]{5,120})"                         # description: starts uppercase, 5-120 chars
    ,
    re.MULTILINE,
)

# Extract circuit structure: "8 rounds" or "X rounds" from surrounding text
_ROUNDS_RE = re.compile(r"(\d+)\s*(?:rounds?|circuits?|sets?)", re.IGNORECASE)
# Extract work/rest intervals: "40 sec work / 20 sec rest" or "30s on / 15s off"
_INTERVAL_RE = re.compile(
    r"(\d+)\s*(?:sec(?:onds?)?|s)\s*(?:work|on)"
    r"(?:\s*/\s*(\d+)\s*(?:sec(?:onds?)?|s)\s*(?:rest|off))?",
    re.IGNORECASE,
)

# Workout title: "ROUTINE #5: GLUTES ONLY – 6 EXERCISES" or similar
_WORKOUT_TITLE_RE = re.compile(
    r"(?:ROUTINE|WORKOUT)\s*#?\d*:?\s*(.+?)(?:\s*[–—-]\s*\d+\s*EXERCISE|\n|$)",
    re.IGNORECASE,
)

_WORKOUT_TYPE_HINTS = {
    "cardio": re.compile(r"\b(hiit|circuit|emom|amrap|tabata|conditioning|sprint|cardio)\b", re.IGNORECASE),
    "push": re.compile(r"\b(chest|shoulder|tricep|push)\b", re.IGNORECASE),
    "pull": re.compile(r"\b(back|bicep|pull|row)\b", re.IGNORECASE),
    "legs": re.compile(r"\b(leg|quad|hamstring|glute|squat|calf)\b", re.IGNORECASE),
    "upper": re.compile(r"\b(upper)\b", re.IGNORECASE),
    "lower": re.compile(r"\b(lower)\b", re.IGNORECASE),
    "full_body": re.compile(r"\b(full.?body)\b", re.IGNORECASE),
}

# Ordered list — more specific matches first to avoid "back squat" → "back"
_MUSCLE_KEYWORDS_ORDERED: list[tuple[str, list[str]]] = [
    ("glutes", ["glute", "hip thrust", "bulgarian", "kickback", "pull-through"]),
    ("chest", ["chest", "pec", "bench press", "flye", "fly", "push-up", "pushup"]),
    ("legs", ["squat", "leg", "quad", "hamstring", "lunge", "leg press", "calf"]),
    ("shoulders", ["shoulder", "delt", "overhead press", "lateral raise", "ohp"]),
    ("back", ["row", "lat ", "latissimus", "pull-up", "pullup", "deadlift", "pull-down"]),
    ("biceps", ["bicep", "curl"]),
    ("triceps", ["tricep", "pushdown", "skull crusher", "close-grip", "dip"]),
    ("core", ["core", "ab", "plank", "crunch"]),
    ("cardio", ["cardio", "running", "sprint", "assault", "swing"]),
]


def _guess_muscle_group(exercise_name: str) -> str:
    name_lower = exercise_name.lower()
    for muscle, keywords in _MUSCLE_KEYWORDS_ORDERED:
        for kw in keywords:
            if kw in name_lower:
                return muscle
    return "full_body"


def _parse_workout_from_text(text: str) -> dict | None:
    """Parse a workout from assistant text. Returns generate_workout params or None.

    Tries weight-lifting pattern first (sets × reps). If that fails,
    tries description-style pattern (HIIT / cardio / circuits).
    """
    # --- Try Pattern A: weight-lifting (sets × reps) ---
    matches = _EXERCISE_LINE_RE.findall(text)
    if len(matches) >= 3:
        exercises = []
        for name, sets_str, reps, rest_val, rest_unit in matches:
            name = name.strip().rstrip("* ")
            if name.count(".") > 0 or len(name.split()) > 8:
                continue
            rest = None
            if rest_val:
                rest_float = float(rest_val)
                rest = int(rest_float * 60) if rest_unit == "min" else int(rest_float)
            exercises.append({
                "name": name,
                "muscle_group": _guess_muscle_group(name),
                "sets": int(sets_str),
                "reps": reps,
                "rest_seconds": rest,
                "notes": "",
            })
        if len(exercises) >= 3:
            return _build_parsed_result(text, exercises, "lifting")

    # --- Try Pattern B: HIIT / cardio / circuit (description-style) ---
    desc_matches = _EXERCISE_DESC_LINE_RE.findall(text)
    if len(desc_matches) >= 3:
        # Extract circuit params from surrounding text
        rounds_m = _ROUNDS_RE.search(text)
        interval_m = _INTERVAL_RE.search(text)
        rounds = int(rounds_m.group(1)) if rounds_m else 3
        work_sec = int(interval_m.group(1)) if interval_m else None
        rest_sec = int(interval_m.group(2)) if interval_m and interval_m.group(2) else 20

        exercises = []
        seen_names: set[str] = set()
        for name, description in desc_matches:
            name = name.strip().rstrip("* ")
            if name.count(".") > 0 or len(name.split()) > 8:
                continue
            # Deduplicate (same exercise name can match twice if reformatted)
            name_key = name.lower()
            if name_key in seen_names:
                continue
            seen_names.add(name_key)

            # Use work interval as "reps" display (e.g. "40s")
            reps_str = f"{work_sec}s" if work_sec else "AMRAP"
            exercises.append({
                "name": name,
                "muscle_group": _guess_muscle_group(name),
                "sets": rounds,
                "reps": reps_str,
                "rest_seconds": rest_sec,
                "notes": description.strip().rstrip(". "),
            })
        if len(exercises) >= 3:
            # Detect HIIT vs generic cardio from text
            is_hiit = bool(re.search(r"\b(HIIT|tabata|EMOM|AMRAP)\b", text, re.IGNORECASE))
            return _build_parsed_result(text, exercises, "hiit" if is_hiit else "cardio")

    return None


def _build_parsed_result(text: str, exercises: list[dict], category: str) -> dict:
    """Build the final parsed workout dict from exercises."""
    title_match = _WORKOUT_TITLE_RE.search(text)
    workout_name = title_match.group(1).strip() if title_match else None

    all_names = " ".join(e["name"] for e in exercises)
    workout_type = "custom"
    for wt, pattern in _WORKOUT_TYPE_HINTS.items():
        if pattern.search(all_names):
            workout_type = wt
            break

    # Non-lifting categories always get "cardio" workout_type
    if category != "lifting":
        workout_type = "cardio"

    return {
        "workout_type": workout_type,
        "category": category,
        "name": workout_name or "Custom Workout",
        "exercises": exercises,
    }


# ─── Equipment validation ─────────────────────────────────────────────────────

# Map common free-text equipment entries to normalized keywords.
# User might type "dumbells" or "Dumbbells (100 lb)" — we normalize.
_EQUIPMENT_ALIASES: dict[str, list[str]] = {
    "barbell": ["barbell", "barbells", "bar"],
    "dumbbells": ["dumbbell", "dumbbells", "dumbells", "db"],
    "bench": ["bench", "flat bench", "incline", "decline"],
    "smith machine": ["smith machine", "smith"],
    "cables": ["cables", "cable machine", "cable"],
    "pull-up bar": ["pullup", "pull-up", "pull up", "chin-up", "chinup"],
    "kettlebells": ["kettlebell", "kettlebells", "kb"],
    "rack": ["rack", "squat rack", "power rack"],
    "assault runner": ["assault", "assault runner", "treadmill"],
    "rower": ["rower", "rowing", "row machine"],
    "ab wheel": ["ab wheel", "ab roller"],
    "bands": ["bands", "resistance bands", "band"],
    "machine": ["machine", "machines"],
}


def _parse_user_equipment(equipment_text: str) -> set[str]:
    """Parse user's free-text equipment into normalized equipment keywords."""
    text_lower = equipment_text.lower()
    available = set()
    # Process longer aliases first to avoid false positives
    # (e.g., "cable machine" should match cables, not machine)
    for canonical, aliases in sorted(_EQUIPMENT_ALIASES.items(), key=lambda x: -max(len(a) for a in x[1])):
        for alias in sorted(aliases, key=len, reverse=True):
            if alias in text_lower:
                available.add(canonical)
                break
    # Remove "machine" if it was only matched via compound terms like
    # "smith machine", "cable machine", "row machine" — these are NOT generic gym machines.
    # Only keep "machine" if user explicitly has standalone machines (leg press, pec deck, etc.)
    if "machine" in available:
        import re
        # Strip all known compound "X machine" terms
        stripped = re.sub(r"(smith|cable|row|rowing)\s+machine", "", text_lower)
        if "machine" not in stripped and "machines" not in stripped:
            available.discard("machine")
    return available


def _exercise_fits_equipment(
    exercise_equip: str | None,
    user_equipment: set[str],
) -> bool:
    """Check if an exercise's equipment requirements are met by the user's equipment.

    Returns True if the exercise can be performed, False if it requires
    equipment the user doesn't have.
    """
    if not exercise_equip:
        # Bodyweight / no equipment needed
        return True

    # Split "barbell, bench" into individual requirements
    required = [r.strip().lower() for r in exercise_equip.split(",")]

    for req in required:
        # Check if any canonical equipment matches this requirement
        matched = False
        for canonical, aliases in _EQUIPMENT_ALIASES.items():
            if req in aliases or req == canonical:
                if canonical in user_equipment:
                    matched = True
                    break
        # Also check direct substring match against user equipment set
        if not matched:
            for equip in user_equipment:
                if req in equip or equip in req:
                    matched = True
                    break
        if not matched:
            return False

    return True


def _normalize_name(name: str) -> str:
    """Normalize an exercise name for comparison: lowercase, strip parenthetical, collapse spaces."""
    n = name.lower().strip()
    n = re.sub(r"\s*\(.*?\)\s*", " ", n)  # Remove parenthetical like "(Dumbbells)"
    n = re.sub(r"\s+", " ", n).strip()
    return n


def _name_words(name: str) -> set[str]:
    """Get the set of significant words from a name."""
    return set(_normalize_name(name).split())


def _match_exercise(name: str, all_exercises: list) -> "Exercise | None":
    """Smart exercise name matching with multiple strategies.

    1. Exact match (case-insensitive)
    2. Normalized match (strip parenthetical, compare)
    3. Word-set match (all significant words of one name contained in the other)
    4. Substring match (DB name contains input or vice versa)
    """
    name_lower = name.lower().strip()
    name_norm = _normalize_name(name)
    name_words = _name_words(name)

    # Strategy 1: Exact case-insensitive
    for ex in all_exercises:
        if ex.name.lower().strip() == name_lower:
            return ex

    # Strategy 2: Normalized match (e.g. "Lateral Raise (Dumbbells)" == "Lateral Raise")
    for ex in all_exercises:
        if _normalize_name(ex.name) == name_norm:
            return ex

    # Strategy 3: Word-set overlap (handles word-order differences)
    # e.g. "Lateral Raise (Dumbbells)" words = {lateral, raise} matches "Dumbbell Lateral Raise"
    best_match = None
    best_score = 0.0
    for ex in all_exercises:
        ex_words = _name_words(ex.name)
        overlap = name_words & ex_words
        if len(overlap) < 2:
            continue
        # Require the smaller set to be mostly contained in the larger
        smaller = min(len(name_words), len(ex_words))
        score = len(overlap) / smaller
        if score > best_score:
            best_score = score
            best_match = ex

    # Require at least 80% of the smaller word-set to match
    if best_match and best_score >= 0.8:
        return best_match

    # Strategy 4: Substring (DB name contains input name or vice versa)
    for ex in all_exercises:
        ex_lower = ex.name.lower()
        if name_lower in ex_lower or ex_lower in name_lower:
            return ex

    return None


async def _tool_generate_workout(
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Create a workout record with exercises and return its structure."""
    print(f"[Coach] generate_workout called with keys: {list(params.keys())}", flush=True)
    print(f"[Coach] exercises count: {len(params.get('exercises', []))}", flush=True)
    if not params.get("exercises"):
        print(f"[Coach] NO EXERCISES! Full params: {json.dumps(params, default=str)[:500]}", flush=True)
    tips = params.get("tips", "")

    # Load user profile for equipment validation
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    gym_type = user.gym_type if user else None
    user_equipment: set[str] | None = None
    if gym_type == "own_gym" and user and user.equipment_text:
        user_equipment = _parse_user_equipment(user.equipment_text)
        logger.info(f"[Coach] Home gym equipment detected: {user_equipment}")

    # Get next display_id for this user
    max_result = await db.execute(
        select(func.max(Workout.display_id)).where(Workout.user_id == user_id)
    )
    max_id = max_result.scalar() or 0
    next_display_id = max_id + 1

    raw_name = params.get("name") or f"{params['workout_type'].replace('_', ' ')} day"
    workout_name = raw_name.lower().strip().rstrip("*")
    workout = Workout(
        id=cuid_generator.generate(),
        user_id=user_id,
        workout_type=params["workout_type"],
        category=params.get("category", "lifting"),
        source=params.get("source", "coach"),
        name=workout_name,
        date=datetime.now(user_tz).astimezone(tz.utc).replace(tzinfo=None) if user_tz else datetime.utcnow(),
        display_id=next_display_id,
        notes=tips or None,
    )
    db.add(workout)
    await db.flush()

    # Pre-load all exercises for matching
    all_exercises_result = await db.execute(select(Exercise))
    all_exercises = all_exercises_result.scalars().all()

    # Store exercises — look up from DB to link exerciseId
    exercises_data = params.get("exercises", [])
    stored = []
    rejected = []
    for i, ex in enumerate(exercises_data):
        # Try to find matching exercise in DB by name (case-insensitive)
        exercise_id = None
        ex_name = ex.get("name", "")
        found_exercise = None
        if ex_name:
            found_exercise = _match_exercise(ex_name, all_exercises)
            if found_exercise:
                exercise_id = found_exercise.id
                logger.info(f"[Coach] Linked exercise '{ex_name}' -> '{found_exercise.name}' (id {found_exercise.id})")

                # Equipment check for home gym users
                if user_equipment is not None and found_exercise.equipment_required:
                    if not _exercise_fits_equipment(found_exercise.equipment_required, user_equipment):
                        rejected.append({
                            "name": ex_name,
                            "requires": found_exercise.equipment_required,
                        })
                        logger.info(
                            f"[Coach] REJECTED '{ex_name}' — requires '{found_exercise.equipment_required}' "
                            f"but user only has {user_equipment}"
                        )
                        continue  # Skip this exercise

                # Auto-search YouTube if matched exercise has no videos yet
                existing_vids = await db.execute(
                    select(ExerciseVideo.id).where(
                        ExerciseVideo.exercise_id == found_exercise.id,
                        ExerciseVideo.status.in_(["approved", "pending"]),
                    )
                )
                if not existing_vids.first():
                    try:
                        vid_added = await _link_best_video(db, found_exercise)
                        if vid_added:
                            logger.info(f"[Coach] Auto-linked tutorial video for existing exercise '{found_exercise.name}'")
                    except Exception as e:
                        logger.warning(f"[Coach] Video auto-link failed for '{found_exercise.name}': {e}")
            else:
                # Equipment check for unmatched exercises (name-based heuristic)
                if user_equipment is not None:
                    name_lower = ex_name.lower()
                    # Machine-requiring keywords — reject if user has no machine
                    _machine_kw = ["machine", "smith", "leg press", "hack squat",
                                   "pec deck", "leg extension", "leg curl",
                                   "chest fly machine", "seated row machine",
                                   "chest press", "shoulder press machine"]
                    # Cable-requiring keywords — reject if user has no cables
                    _cable_kw = ["cable", "lat pulldown", "cable crossover",
                                 "cable fly", "face pull", "tricep pushdown",
                                 "cable curl"]
                    needs_machine = any(kw in name_lower for kw in _machine_kw)
                    needs_cable = any(kw in name_lower for kw in _cable_kw)
                    has_machine = "machine" in user_equipment
                    has_cables = "cables" in user_equipment
                    if (needs_machine and not has_machine) or (needs_cable and not has_cables):
                        req = "machine" if needs_machine else "cables"
                        rejected.append({"name": ex_name, "requires": req})
                        logger.info(f"[Coach] REJECTED unmatched exercise '{ex_name}' — requires {req} but user doesn't have it")
                        continue

                # Auto-add to exercise library so Video Linker can find tutorials later
                muscle_group = ex.get("muscle_group", "full_body")
                new_exercise = Exercise(
                    id=cuid_generator.generate(),
                    name=ex_name,
                    muscle_group=muscle_group,
                    difficulty="intermediate",
                    exercise_type="compound",
                )
                db.add(new_exercise)
                await db.flush()
                exercise_id = new_exercise.id
                all_exercises.append(new_exercise)
                logger.info(f"[Coach] Auto-added exercise '{ex_name}' to library -> {new_exercise.id}")

                # Auto-search YouTube for a tutorial video (fire-and-forget)
                try:
                    added = await _link_best_video(db, new_exercise)
                    if added:
                        logger.info(f"[Coach] Auto-linked tutorial video for '{ex_name}'")
                except Exception as e:
                    logger.warning(f"[Coach] Video auto-link failed for '{ex_name}': {e}")

        # Store notes in pipe-delimited format: name|muscleGroup|coachingTip
        # This allows the frontend to parse exercise info even when not linked to DB
        coaching_tip = ex.get("notes", "")
        notes_str = f"{ex_name}|{ex.get('muscle_group', '')}|{coaching_tip}"

        we = WorkoutExercise(
            id=cuid_generator.generate(),
            workout_id=workout.id,
            exercise_id=exercise_id,
            order=len(stored) + 1,
            sets=ex.get("sets", 3),
            reps=ex.get("reps"),
            rest_seconds=ex.get("rest_seconds"),
            notes=notes_str,
            superset_group=ex.get("superset_group"),
        )
        db.add(we)
        stored.append({
            "name": ex_name,
            "muscle_group": ex.get("muscle_group", ""),
            "sets": ex.get("sets", 3),
            "reps": ex.get("reps", ""),
        })

    await db.commit()
    logger.info(f"[Coach] Workout {workout.id} committed to DB with {len(stored)} exercises ({len(rejected)} rejected)")

    result = {
        "workout_id": workout.id,
        "display_number": workout.display_id,
        "workout_type": workout.workout_type,
        "category": workout.category,
        "name": workout.name,
        "exercises_stored": len(stored),
        "exercises": stored,
        "message": (
            f"Routine #{workout.display_id} created with {len(stored)} exercises stored. "
            "Present the full workout to the user with coaching tips. "
            f"The user can refer to this routine as #{workout.display_id}. "
            "IMPORTANT: Never show the workout_id to the user — only refer to the routine by its display_number."
        ),
    }

    if rejected:
        rejected_names = ", ".join(r["name"] for r in rejected)
        result["equipment_warning"] = (
            f"WARNING: {len(rejected)} exercise(s) were REMOVED because the user has a home gym "
            f"and doesn't have the required equipment: {rejected_names}. "
            f"Their available equipment: {', '.join(sorted(user_equipment or set()))}. "
            "Tell the user which exercises were removed and why, then suggest replacements "
            "that only use their available equipment. Call generate_workout again if you want to add replacements."
        )

    return result


def _sanitize_raw_text(text: str) -> str:
    """Strip XML/HTML-like parameter tags that Claude sometimes injects into raw_text."""
    # Remove patterns like: "> <parameter name="calories">200
    cleaned = re.sub(r'["\']?\s*>\s*<parameter\s+name="[^"]*">[^<]*(?:</parameter>)?', '', text)
    # Remove any remaining XML-like tags
    cleaned = re.sub(r'<[^>]+>', '', cleaned)
    # Clean up trailing quotes and whitespace
    cleaned = cleaned.strip().rstrip('"').rstrip("'").strip()
    return cleaned


async def _tool_log_nutrition(
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Log a nutrition entry using the user's local date.

    Uses the dedicated nutrition agent for macro extraction when possible,
    falling back to Claude's estimates if the agent fails.
    """
    # Use user's timezone to determine the correct "now" and "today"
    if user_tz:
        user_now = datetime.now(user_tz)
    else:
        user_now = datetime.now(tz.utc)

    # Sanitize raw_text — Claude sometimes injects XML parameter tags
    raw_text = _sanitize_raw_text(params["raw_text"])

    # Use Claude's macro estimates directly (no re-extraction — Pydantic validates upstream)
    calories = params.get("calories")
    protein_g = params.get("protein_g")
    carbs_g = params.get("carbs_g")
    fat_g = params.get("fat_g")

    # Store as UTC but ensure the date component matches the user's local date
    log = NutritionLog(
        id=cuid_generator.generate(),
        user_id=user_id,
        date=user_now.astimezone(tz.utc).replace(tzinfo=None),
        meal_type=params.get("meal_type"),
        raw_input=raw_text,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        fiber_g=params.get("fiber_g"),
    )
    db.add(log)
    try:
        await db.commit()
        logger.info(f"[Coach] Nutrition log {log.id} committed to DB")
    except Exception as e:
        logger.error(f"[Coach] FAILED to commit nutrition log: {e}")
        await db.rollback()
        raise

    # Get daily totals using user's local date
    # Wrapped in try/except so a totals query failure doesn't hide the successful log
    user_today = user_now.date()
    try:
        daily = await _get_daily_totals(db, user_id, user_today, user_tz=user_tz)
    except Exception as e:
        logger.error(f"[Coach] Failed to get daily totals after logging: {e}")
        daily = {"date": str(user_today), "total_calories": 0, "total_protein_g": 0, "total_carbs_g": 0, "total_fat_g": 0, "meal_count": 0}

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
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Get recent workout history."""
    days_back = params.get("days_back", 14)
    if user_tz:
        cutoff = (datetime.now(user_tz) - timedelta(days=days_back)).astimezone(tz.utc).replace(tzinfo=None)
    else:
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
                "display_number": w.display_id,
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
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Get nutrition totals for a date."""
    if params.get("date"):
        target_date = date.fromisoformat(params["date"])
    elif user_tz:
        target_date = datetime.now(user_tz).date()
    else:
        target_date = date.today()

    return await _get_daily_totals(db, user_id, target_date, user_tz=user_tz)


async def _get_daily_totals(
    db: AsyncSession, user_id: str, target_date: date, user_tz: ZoneInfo | None = None
) -> dict:
    """Helper to aggregate daily nutrition totals using timezone-aware date range."""
    if user_tz:
        # Compute midnight-to-midnight in user's timezone, converted to UTC
        day_start_local = datetime(target_date.year, target_date.month, target_date.day, tzinfo=user_tz)
        day_end_local = day_start_local + timedelta(days=1)
        day_start_utc = day_start_local.astimezone(tz.utc).replace(tzinfo=None)
        day_end_utc = day_end_local.astimezone(tz.utc).replace(tzinfo=None)
        result = await db.execute(
            select(NutritionLog).where(
                NutritionLog.user_id == user_id,
                NutritionLog.date >= day_start_utc,
                NutritionLog.date < day_end_utc,
            )
        )
    else:
        # Fallback: use DB date extraction (server timezone)
        result = await db.execute(
            select(NutritionLog).where(
                NutritionLog.user_id == user_id,
                func.date(NutritionLog.date) == target_date,
            )
        )
    logs = result.scalars().all()

    return {
        "date": str(target_date),
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
    await db.commit()
    logger.info(f"[Coach] Workout {workout.id} marked complete")

    return {
        "workout_id": workout.id,
        "completed": True,
        "fatigue_rating": workout.fatigue_rating,
    }


async def _tool_log_activity(
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Log a generic activity (no exercises)."""
    activity = Activity(
        id=cuid_generator.generate(),
        user_id=user_id,
        name=params["name"],
        duration_minutes=params.get("duration_minutes"),
        notes=params.get("notes"),
        date=datetime.now(user_tz).astimezone(tz.utc).replace(tzinfo=None) if user_tz else datetime.utcnow(),
    )
    db.add(activity)
    await db.commit()
    logger.info(f"[Coach] Activity {activity.id} logged: {activity.name}")

    duration_str = f" ({activity.duration_minutes} min)" if activity.duration_minutes else ""
    return {
        "activity_id": activity.id,
        "name": activity.name,
        "duration_minutes": activity.duration_minutes,
        "message": f"Logged '{activity.name}'{duration_str}. This shows in the Activities tab.",
    }


async def _tool_log_routine_done(
    db: AsyncSession, user_id: str, params: dict, user_tz: ZoneInfo | None = None
) -> dict:
    """Clone an existing routine to history as a completed session."""
    routine_name = params["routine_name"].strip().lower()

    # Find all uncompleted workouts for this user (routine templates)
    result = await db.execute(
        select(Workout)
        .options(selectinload(Workout.exercises))
        .where(Workout.user_id == user_id, Workout.completed == False)  # noqa: E712
    )
    templates = result.scalars().all()

    if not templates:
        return {"error": "No routines found. Create a routine first."}

    # Try matching by display_id first (e.g. "routine 26" → display_id=26)
    best = None
    display_match = re.search(r'\b(\d+)\b', routine_name)
    if display_match:
        target_id = int(display_match.group(1))
        for t in templates:
            if t.display_id == target_id:
                best = t
                break

    # Fallback: match by name (case-insensitive partial match)
    if not best:
        best_score = 0
        for t in templates:
            t_name = (t.name or t.workout_type or "").lower()
            if routine_name in t_name or t_name in routine_name:
                score = len(routine_name) / max(len(t_name), 1)
                if score > best_score:
                    best_score = score
                    best = t
            # Also try matching individual words
            elif any(word in t_name for word in routine_name.split() if len(word) > 2):
                if not best:
                    best = t

    if not best:
        available = [t.name or t.workout_type for t in templates]
        return {
            "error": f"No routine matching '{params['routine_name']}' found.",
            "available_routines": available,
        }

    # Clone the routine as a completed session
    now = datetime.now(user_tz).astimezone(tz.utc).replace(tzinfo=None) if user_tz else datetime.utcnow()
    new_id = cuid_generator.generate()
    clone = Workout(
        id=new_id,
        user_id=user_id,
        date=now,
        name=best.name,
        workout_type=best.workout_type,
        category=best.category,
        source=best.source,
        duration_minutes=params.get("duration_minutes"),
        notes=params.get("notes"),
        fatigue_rating=params.get("fatigue_rating"),
        completed=True,
    )
    db.add(clone)

    # Clone exercises
    for ex in best.exercises:
        db.add(WorkoutExercise(
            id=cuid_generator.generate(),
            workout_id=new_id,
            exercise_id=ex.exercise_id,
            variation_id=ex.variation_id,
            order=ex.order,
            sets=ex.sets,
            reps=ex.reps,
            weight_kg=ex.weight_kg,
            rest_seconds=ex.rest_seconds,
            notes=ex.notes,
            was_spicy=ex.was_spicy,
            superset_group=ex.superset_group,
        ))

    await db.commit()
    logger.info(f"[Coach] Routine '{best.name}' cloned to history as {new_id}")

    return {
        "workout_id": new_id,
        "routine_name": best.name or best.workout_type,
        "exercise_count": len(best.exercises),
        "completed": True,
        "message": f"Logged '{best.name or best.workout_type}' as done! It's now in your history.",
    }


async def handle_chat(
    user_id: str,
    user_message: str,
    db: AsyncSession,
    topic: str = "workout",
    image_base64: str | None = None,
    image_media_type: str | None = None,
    timezone: str | None = None,
    use_vision: bool = False,
) -> dict:
    """
    Main agent entry point.

    Handles the full tool-use loop: sends user message to Claude,
    executes any tool calls, sends results back, repeats until
    Claude returns a text response.
    """
    # Parse user timezone
    user_tz: ZoneInfo | None = None
    if timezone:
        try:
            user_tz = ZoneInfo(timezone)
        except (KeyError, ValueError):
            logger.warning(f"Invalid timezone '{timezone}', falling back to UTC")

    # ── Fast path: vision nutrition agent for food photos (Pro/Unlimited only) ──
    if (
        use_vision
        and image_base64
        and image_media_type
        and topic == "nutrition"
    ):
        # Tier gate — Pro/Unlimited only
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or user.tier == "free":
            return {
                "response": "Vision food analysis is available on Pro and Unlimited plans. Upgrade to analyze food photos with AI.",
                "workout_id": None,
                "nutrition_log_id": None,
                "model_used": None,
            }

        # Rate limit check
        allowed, limit_reason = await check_rate_limit(db, user_id)
        if not allowed:
            return {
                "response": f"I can't process your request right now. {limit_reason}",
                "workout_id": None,
                "nutrition_log_id": None,
                "model_used": None,
            }

        logger.info("[Coach] Routing to vision nutrition agent")
        try:
            # Use the user's weight unit preference (lb → oz, kg → grams)
            weight_unit = user.weight_unit or "kg"
            result = await vision_nutrition_agent.extract_and_validate(
                image_base64, image_media_type, user_text=user_message, weight_unit=weight_unit
            )
            if "error" not in result:
                # Log token usage for vision call
                usage = result.pop("_usage", None)
                if usage:
                    request_id = str(uuid.uuid4())[:8]
                    await log_token_usage(db, user_id, "vision_nutrition", settings.agent_model, usage, request_id=request_id)

                # Log nutrition via existing tool handler
                log_result = await _tool_log_nutrition(
                    db, user_id,
                    {
                        "raw_text": result["raw_text"],
                        "meal_type": "snack",
                        "calories": result["total_calories"],
                        "protein_g": result["total_protein_g"],
                        "carbs_g": result["total_carbs_g"],
                        "fat_g": result["total_fat_g"],
                    },
                    user_tz=user_tz,
                )

                daily = log_result.get("daily_totals", {})
                conf = result["confirmation"]
                cal = result["total_calories"]
                pro = result["total_protein_g"]
                carb = result["total_carbs_g"]
                fat = result["total_fat_g"]
                daily_cal = daily.get("total_calories", 0)
                daily_pro = daily.get("total_protein_g", 0)
                resp_text = (
                    f"Logged {conf} — {cal} cal | {pro}g protein | {carb}g carbs | {fat}g fat.\n"
                    f"Daily total: {daily_cal} cal, {daily_pro}g protein."
                )
                return {
                    "response": resp_text,
                    "workout_id": None,
                    "nutrition_log_id": log_result.get("nutrition_log_id"),
                    "model_used": settings.agent_model,
                }
            else:
                return {
                    "response": result["error"],
                    "workout_id": None,
                    "nutrition_log_id": None,
                    "model_used": settings.agent_model,
                }
        except Exception as e:
            logger.warning(f"[Coach] Vision nutrition agent failed ({e}), falling through to general handler")
            # Fall through to general coach with image

    # ── Fast path: dedicated nutrition agent for simple food logging ──
    # Routes food logging to the nutrition agent regardless of topic
    if (
        not image_base64
        and user_message
        and detect_food_logging_intent(user_message)
    ):
        logger.info("[Coach] Routing to dedicated nutrition agent")
        try:
            result = await nutrition_agent.extract_and_validate(user_message)
            if "error" not in result:
                # Log to DB using the existing _tool_log_nutrition
                log_result = await _tool_log_nutrition(
                    db, user_id,
                    {
                        "raw_text": result["raw_text"],
                        "meal_type": "snack",  # default; coach would infer better
                        "calories": result["total_calories"],
                        "protein_g": result["total_protein_g"],
                        "carbs_g": result["total_carbs_g"],
                        "fat_g": result["total_fat_g"],
                    },
                    user_tz=user_tz,
                )
                daily = log_result.get("daily_totals", {})

                # Build friendly confirmation
                conf = result["confirmation"]
                cal = result["total_calories"]
                pro = result["total_protein_g"]
                carb = result["total_carbs_g"]
                fat = result["total_fat_g"]
                daily_cal = daily.get("total_calories", 0)
                daily_pro = daily.get("total_protein_g", 0)
                resp_text = (
                    f"Logged {conf} — {cal} cal | {pro}g protein | {carb}g carbs | {fat}g fat.\n"
                    f"Daily total: {daily_cal} cal, {daily_pro}g protein."
                )

                return {
                    "response": resp_text,
                    "workout_id": None,
                    "nutrition_log_id": log_result.get("nutrition_log_id"),
                    "model_used": settings.haiku_model,
                }
        except Exception as e:
            logger.warning(f"[Coach] Nutrition agent failed ({e}), falling through to general handler")
            # Fall through to general coach

    # Load context
    user_data = await _load_user_context(db, user_id)
    context = build_user_context(user_data, user_tz=user_tz)
    history = await _load_conversation_history(db, user_id, topic=topic)

    # Build user content — text only, or text + image for vision
    if image_base64 and image_media_type:
        text = user_message or "Analyze this image and log the nutrition info."
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type,
                    "data": image_base64,
                },
            },
            {"type": "text", "text": text},
        ]
    else:
        user_content = user_message

    # Build messages
    messages = history + [{"role": "user", "content": user_content}]

    # Call Claude with MiniMax fallback on transient errors
    # Use prompt caching: system prompt is stable, user context changes per user
    system_blocks = [
        {"type": "text", "text": COACH_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": context},
    ]
    # Cache tool definitions (add cache_control to last tool)
    cached_tools = TOOL_DEFINITIONS[:-1] + [
        {**TOOL_DEFINITIONS[-1], "cache_control": {"type": "ephemeral"}}
    ]

    # Rate limiting
    allowed, limit_reason = await check_rate_limit(db, user_id)
    if not allowed:
        return {
            "response": f"I can't process your request right now. {limit_reason}",
            "workout_id": None,
            "nutrition_log_id": None,
            "model_used": None,
        }

    # Select model based on user tier
    active_model = await get_model_for_tier(db, user_id)
    request_id = str(uuid.uuid4())[:8]

    try:
        response = await client.messages.create(
            model=active_model,
            max_tokens=2048,
            system=system_blocks,
            messages=messages,
            tools=cached_tools,
        )

        # Log initial API call usage
        await log_token_usage(db, user_id, "chat", active_model, response.usage, request_id=request_id)

        # Tool-use loop
        workout_id = None
        nutrition_log_id = None
        nutrition_logged_this_turn = False  # Guard: only one log_nutrition per user message

        logger.info(f"[Coach] Initial stop_reason: {response.stop_reason}")
        while response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info(f"[Coach] Tool call: {block.name} with input keys: {list(block.input.keys())}")
                    # Deduplicate: skip extra log_nutrition calls in the same turn
                    if block.name == "log_nutrition" and nutrition_logged_this_turn:
                        logger.warning("[Coach] Skipping duplicate log_nutrition call in same turn")
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps({"error": "Duplicate log_nutrition call skipped — items should be combined into a single call."}),
                        })
                        continue
                    result = await _execute_tool(block.name, block.input, user_id, db, user_tz=user_tz)
                    logger.info(f"[Coach] Tool result keys: {list(result.keys())}")
                    # Track IDs for response (but strip from what Claude sees)
                    if "workout_id" in result:
                        workout_id = result["workout_id"]
                    if "nutrition_log_id" in result:
                        nutrition_log_id = result["nutrition_log_id"]
                        nutrition_logged_this_turn = True

                    # Strip internal IDs before sending to Claude
                    claude_result = {k: v for k, v in result.items() if k not in ("workout_id", "nutrition_log_id")}

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(claude_result),
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            response = await client.messages.create(
                model=active_model,
                max_tokens=2048,
                system=system_blocks,
                messages=messages,
                tools=cached_tools,
            )
            await log_token_usage(db, user_id, "chat", active_model, response.usage, request_id=request_id)

        # Extract final text
        assistant_text = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )

        # Safety net: if the topic is nutrition and the user mentioned food but
        # the model didn't call log_nutrition, retry once with a forced instruction.
        if (
            topic == "nutrition"
            and not nutrition_logged_this_turn
            and _looks_like_food_log(user_message)
            and response.stop_reason == "end_turn"
        ):
            logger.warning("[Coach] Model skipped log_nutrition tool — retrying with forced instruction")
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": (
                    "SYSTEM: You did NOT call the log_nutrition tool. The food was NOT saved. "
                    "You MUST call log_nutrition now with the food the user described. "
                    "Do not respond with text — call the tool."
                ),
            })
            response = await client.messages.create(
                model=active_model,
                max_tokens=2048,
                system=system_blocks,
                messages=messages,
                tools=cached_tools,
            )
            await log_token_usage(db, user_id, "chat_retry", active_model, response.usage, request_id=request_id)
            # Process tool calls from the retry
            while response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        logger.info(f"[Coach] Retry tool call: {block.name}")
                        # Dedup guard for retry loop too
                        if block.name == "log_nutrition" and nutrition_logged_this_turn:
                            logger.warning("[Coach] Skipping duplicate log_nutrition in retry loop")
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": json.dumps({"error": "Already logged this turn."}),
                            })
                            continue
                        result = await _execute_tool(block.name, block.input, user_id, db, user_tz=user_tz)
                        if "nutrition_log_id" in result:
                            nutrition_log_id = result["nutrition_log_id"]
                        claude_result = {k: v for k, v in result.items() if k not in ("workout_id", "nutrition_log_id")}
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(claude_result),
                        })
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
                response = await client.messages.create(
                    model=active_model,
                    max_tokens=2048,
                    system=system_blocks,
                    messages=messages,
                    tools=cached_tools,
                )
                await log_token_usage(db, user_id, "chat_retry", active_model, response.usage, request_id=request_id)
            # Use the retry response text
            assistant_text = "".join(
                block.text for block in response.content if hasattr(block, "text")
            )

        # Safety net: if the topic is workout and the user asked for a workout but
        # the model didn't call generate_workout, parse exercises from the text and save directly.
        # This avoids a costly retry API call and is deterministic.
        if (
            topic == "workout"
            and workout_id is None
            and _looks_like_workout_request(user_message)
            and response.stop_reason == "end_turn"
        ):
            parsed = _parse_workout_from_text(assistant_text)
            if parsed and len(parsed.get("exercises", [])) >= 3:
                # Detect if user was logging an external workout (past tense)
                _past_tense = re.search(r"\b(i did|this morning|log this|log my|we did)\b", user_message, re.IGNORECASE)
                if _past_tense:
                    parsed["source"] = "manual"
                logger.warning(
                    f"[Coach] Model skipped generate_workout — auto-saving {len(parsed['exercises'])} "
                    f"exercises parsed from text response (source={parsed.get('source', 'coach')})"
                )
                try:
                    result = await _tool_generate_workout(db, user_id, parsed)
                    workout_id = result.get("workout_id")
                    logger.info(f"[Coach] Auto-saved workout {workout_id} from text parse")
                except Exception as e:
                    logger.error(f"[Coach] Failed to auto-save parsed workout: {e}")
            else:
                logger.warning("[Coach] Model skipped generate_workout and text parse failed — workout NOT saved")

        # Tool-created records are committed immediately in each tool handler.
        # Final commit is a no-op safety net in case any tool only flushed.
        try:
            await db.commit()
        except Exception as e:
            logger.error(f"[Coach] Final commit error (data already committed per-tool): {e}")

        # Strip any leaked <think> tags from the response
        assistant_text = re.sub(r"<think>[\s\S]*?</think>\s*", "", assistant_text).strip()

        return {
            "response": assistant_text,
            "workout_id": workout_id,
            "nutrition_log_id": nutrition_log_id,
            "model_used": active_model,
        }

    except (APIStatusError, APIConnectionError) as e:
        # Re-raise auth errors — fallback won't help
        if isinstance(e, APIStatusError) and e.status_code in (401, 403):
            raise

        status = getattr(e, 'status_code', None)
        body = getattr(e, 'body', None)
        logger.error(f"[Coach] Anthropic error (status={status}, model={active_model}): {e}")
        if body:
            logger.error(f"[Coach] Error body: {body}")

        # If the request had an image, don't fall back to MiniMax (it can't handle images).
        # Instead, return a clear error so the user knows to retry.
        if image_base64:
            logger.warning("[Coach] Image request failed — cannot fallback to MiniMax for images")
            return {
                "response": "I couldn't process that image right now. Please try again in a moment, or try a smaller/clearer photo.",
                "workout_id": None,
                "nutrition_log_id": None,
                "model_used": None,
            }

        logger.warning("[Coach] Falling back to MiniMax")
        system_plain = COACH_SYSTEM_PROMPT + "\n" + context
        fallback_text = await handle_chat_minimax(user_message, history, system_plain)
        # Strip any leaked <think> tags
        fallback_text = re.sub(r"<think>[\s\S]*?</think>\s*", "", fallback_text).strip()
        return {
            "response": fallback_text,
            "workout_id": None,
            "nutrition_log_id": None,
            "model_used": settings.minimax_model,
        }
