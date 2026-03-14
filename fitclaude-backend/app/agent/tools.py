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
            "and band exercises matching their equipment. Violating this is a critical error."
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
                    "description": "The training style: lifting (weights/machines), hiit (high-intensity intervals), cardio (running/cycling/swimming), mobility (stretching/yoga/recovery), calisthenics (bodyweight), sport (sport-specific drills)",
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
        "name": "lookup_user_foods",
        "description": (
            "Search the user's personal food database for previously logged foods with "
            "verified macros. ALWAYS call this before log_nutrition to check if the food "
            "has known macros. Returns macros per base serving unit — multiply by the "
            "user's requested quantity to get final values."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "food_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of food names to look up (e.g. ['chicken breast', 'protein shake'])",
                },
            },
            "required": ["food_names"],
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
]
