"""Tool definitions for the Coach agent (Claude tool_use format)."""

TOOL_DEFINITIONS = [
    {
        "name": "generate_workout",
        "description": (
            "Generate a workout routine for the user based on their equipment, goals, "
            "and history. Call this when the user wants a workout plan. "
            "IMPORTANT: You MUST include the 'exercises' array with every exercise "
            "in the workout — name, muscle_group, sets, reps, and coaching notes/tips. "
            "CRITICAL: ONLY suggest exercises the user can perform with their listed equipment. "
            "If the user has an own_gym with no machines/cables, NEVER include machine exercises, "
            "cable exercises, or smith machine exercises. Use ONLY barbell, dumbbell, bodyweight, "
            "and band exercises matching their equipment. Violating this is a critical error. "
            "CARDIO/CONDITIONING: when category='cardio', each item in 'exercises' is a SEGMENT — "
            "set duration_seconds and/or distance (+distance_unit) instead of weights, use 'sets' as "
            "the number of rounds (default 1), and keep 'reps' only for rep-based moves (e.g. burpees). "
            "Never assign weights to cardio segments."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_type": {
                    "type": "string",
                    "enum": [
                        "push", "pull", "legs", "upper", "lower",
                        "full_body", "cardio", "custom",
                    ],
                    "description": "The split/type of workout (push/pull/legs for lifting, or custom/cardio/full_body for other styles)",
                },
                "category": {
                    "type": "string",
                    "enum": [
                        "lifting", "hiit", "cardio", "mobility",
                        "calisthenics", "sport",
                    ],
                    "description": "The training style: lifting (weights/machines), hiit (high-intensity intervals), cardio (running/cycling/swimming/rowing/erg/air bike/treadmill or any time-, distance-, or calorie-based conditioning), mobility (stretching/yoga/recovery), calisthenics (bodyweight), sport (sport-specific drills). ALWAYS use 'cardio' when the workout is built around cardio machines or timed/distance/calorie segments — never 'lifting' for those.",
                },
                "name": {
                    "type": "string",
                    "description": "A descriptive name for the workout (e.g. 'Push Day – Chest & Shoulders', 'Leg Day – Quad Focus')",
                },
                "exercises": {
                    "type": "array",
                    "description": "The full list of exercises for this workout",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Exercise name (e.g. 'Barbell Bench Press')",
                            },
                            "muscle_group": {
                                "type": "string",
                                "description": "Primary muscle group (e.g. 'chest', 'triceps', 'back')",
                            },
                            "sets": {
                                "type": "integer",
                                "description": "Number of sets",
                            },
                            "reps": {
                                "type": "string",
                                "description": "Rep range or count (e.g. '8-10', '12', 'failure')",
                            },
                            "rest_seconds": {
                                "type": "integer",
                                "description": "Rest between sets in seconds",
                            },
                            "notes": {
                                "type": "string",
                                "description": "Coaching tips and form cues for this exercise",
                            },
                            "superset_group": {
                                "type": "string",
                                "description": "Superset group label (A, B, etc). Exercises with the same label form a superset pair. Omit for standalone exercises.",
                            },
                            "duration_seconds": {
                                "type": "integer",
                                "description": "CARDIO segments only: target duration in seconds (e.g. 300 for a 5-minute row). Omit for weight exercises.",
                            },
                            "distance": {
                                "type": "number",
                                "description": "CARDIO segments only: target distance value (e.g. 400 for a 400m run, 5 for 5km). Omit for weight exercises.",
                            },
                            "distance_unit": {
                                "type": "string",
                                "enum": ["m", "km", "mi"],
                                "description": "Unit for `distance` — only include alongside `distance`.",
                            },
                            "calories": {
                                "type": "integer",
                                "description": "CARDIO segments only: target calories to burn (air bike, rower, ski erg). Omit for weight exercises.",
                            },
                        },
                        "required": ["name", "muscle_group", "sets", "reps"],
                    },
                },
                "tips": {
                    "type": "string",
                    "description": "General workout tips (rest guidance, progressive overload notes, stretching)",
                },
                "num_exercises": {
                    "type": "integer",
                    "minimum": 3,
                    "maximum": 10,
                    "description": "Number of exercises (default 5)",
                },
                "spicy_level": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 3,
                    "description": (
                        "0=standard exercises, 1=mild variations, "
                        "2=notable twists, 3=advanced variations"
                    ),
                },
                "focus_muscles": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific muscles to emphasize",
                },
                "avoid_exercises": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Exercises to avoid (e.g., due to injury)",
                },
                "source": {
                    "type": "string",
                    "enum": ["coach", "manual"],
                    "description": "Source: 'coach' for AI-generated (default), 'manual' for user-logged external workouts/classes",
                },
                "program_day_id": {
                    "type": "string",
                    "description": "If generating from a training program, the ProgramDay ID to link this workout to. Only set when generating a program day's workout.",
                },
            },
            "required": ["workout_type", "category", "exercises"],
        },
    },
    {
        "name": "log_activity",
        "description": (
            "Log a generic external activity or class without specific exercise details "
            "(e.g. 'Alpha Fit 60 minutes', 'Yoga class', 'Basketball pickup game'). "
            "Use this when the user describes an activity WITHOUT specific sets/reps. "
            "If they provide exercise details, use generate_workout with source='manual' instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the activity or class (e.g. 'Alpha Fit', 'Yoga')",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Duration in minutes",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes about the activity",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "log_nutrition",
        "description": (
            "Parse natural language food description into macros and log it. "
            "Call this when the user tells you what they ate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "raw_text": {
                    "type": "string",
                    "description": "The user's food description in natural language",
                },
                "meal_type": {
                    "type": "string",
                    "enum": [
                        "breakfast", "lunch", "dinner",
                        "snack", "pre_workout", "post_workout",
                    ],
                },
                "calories": {
                    "type": "number",
                    "description": "Estimated total calories",
                },
                "protein_g": {
                    "type": "number",
                    "description": "Estimated protein in grams",
                },
                "carbs_g": {
                    "type": "number",
                    "description": "Estimated carbs in grams",
                },
                "fat_g": {
                    "type": "number",
                    "description": "Estimated fat in grams",
                },
            },
            "required": ["raw_text", "calories", "protein_g", "carbs_g", "fat_g"],
        },
    },
    {
        "name": "get_workout_history",
        "description": "Retrieve the user's recent workout history for progressive overload tracking.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days_back": {
                    "type": "integer",
                    "default": 14,
                    "description": "How many days of history to retrieve",
                },
                "workout_type": {
                    "type": "string",
                    "description": "Optional filter by workout type",
                },
            },
        },
    },
    {
        "name": "get_daily_nutrition",
        "description": "Get nutrition totals for a specific date. Defaults to today.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format. Defaults to today.",
                },
            },
        },
    },
    {
        "name": "get_spicy_variation",
        "description": (
            "Get a 'spicy' variation of a standard exercise to keep workouts interesting. "
            "Use when the user wants something different or says they are bored."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "exercise_name": {
                    "type": "string",
                    "description": "The base exercise to find a variation for",
                },
                "spicy_level": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 3,
                    "description": "1=mild, 2=moderate, 3=intense variation",
                },
            },
            "required": ["exercise_name"],
        },
    },
    {
        "name": "mark_workout_complete",
        "description": "Mark a workout as completed and record the user's fatigue rating.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {"type": "string", "description": "The CUID of the workout to mark complete"},
                "fatigue_rating": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "description": "1=felt easy, 10=completely destroyed",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional post-workout notes",
                },
            },
            "required": ["workout_id", "fatigue_rating"],
        },
    },
    {
        "name": "log_routine_done",
        "description": (
            "Log that the user completed an existing routine. Use this when:\n"
            "1. User says 'I did routine X', 'finished my chest day', 'did Alpha Fit this morning'\n"
            "2. User sends a PHOTO of a routine/whiteboard and asks to log it\n"
            "This clones the routine to history as a completed session while keeping the "
            "original routine template intact. The user does NOT need a workout ID — "
            "just provide the routine name, exercises from a photo, or a partial match. "
            "ALWAYS use this instead of mark_workout_complete when the user describes "
            "having done a routine by name or shows a photo of one."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "routine_name": {
                    "type": "string",
                    "description": (
                        "Name or partial name of the routine to match (e.g. 'chest day', "
                        "'Alpha Fit', 'deadlifts'). If from a photo, extract the workout "
                        "title or describe the exercises to find the best match."
                    ),
                },
                "fatigue_rating": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "description": "1=felt easy, 10=completely destroyed. If user doesn't mention, ask them.",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "How long the workout took in minutes (optional)",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes — for photo-based logs, include extracted exercise details here",
                },
            },
            "required": ["routine_name"],
        },
    },
    {
        "name": "parse_youtube_video",
        "description": (
            "Extract exercises from a YouTube video transcript and add them to the "
            "exercise database. Use when the user shares a YouTube link and wants to "
            "import exercises from it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "youtube_url": {
                    "type": "string",
                    "description": "The YouTube video URL",
                },
            },
            "required": ["youtube_url"],
        },
    },
    {
        "name": "generate_program",
        "description": (
            "Generate a weekly training program with a fixed schedule. Each day of the week "
            "gets a type: 'coached' (AI generates workout), 'pt_session' (user logs PT), "
            "'class' (user logs activity), or 'rest'. Coached days have exercise templates "
            "with 1-2 PRIMARY lifts and 3-4 accessories. For multi-week rotation, include "
            "multiple entries for the same weekday with different week_number values. "
            "weekday: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "total_weeks": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 4,
                    "description": "How many weeks before the rotation repeats (e.g. 2 for A/B week alternation)",
                },
                "days": {
                    "type": "array",
                    "description": "Day entries — one per weekday per week in the rotation",
                    "items": {
                        "type": "object",
                        "properties": {
                            "weekday": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 6,
                                "description": "Day of week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun",
                            },
                            "week_number": {
                                "type": "integer",
                                "minimum": 1,
                                "description": "Which week in the rotation (1-based)",
                            },
                            "day_type": {
                                "type": "string",
                                "enum": ["coached", "pt_session", "class", "rest"],
                                "description": "coached=AI generates, pt_session=user logs PT, class=user logs activity, rest=off day",
                            },
                            "day_label": {
                                "type": "string",
                                "description": "Human-readable label (e.g. 'Deadlifts + Glutes', 'PT Session', 'Alpha X', 'Rest')",
                            },
                            "workout_type": {
                                "type": "string",
                                "enum": ["push", "pull", "legs", "upper", "lower", "full_body", "custom"],
                                "description": "Workout type for coached days (omit for pt/class/rest)",
                            },
                            "keep_existing": {
                                "type": "boolean",
                                "description": "If true, preserve the existing day's exercise template and linked routine — do NOT regenerate. Use this when the user hasn't changed this day's configuration and you want to avoid clobbering their manual edits. Omit or false to regenerate fresh exercises.",
                            },
                            "exercises": {
                                "type": "array",
                                "description": "Exercise template for coached days (omit for pt/class/rest)",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "muscle_group": {"type": "string"},
                                        "sets": {"type": "integer"},
                                        "reps": {"type": "string"},
                                        "is_primary": {
                                            "type": "boolean",
                                            "description": "True for main compound lifts that stay fixed",
                                        },
                                        "notes": {"type": "string"},
                                    },
                                    "required": ["name", "muscle_group", "sets", "reps"],
                                },
                            },
                        },
                        "required": ["weekday", "week_number", "day_type", "day_label"],
                    },
                },
            },
            "required": ["total_weeks", "days"],
        },
    },
]
