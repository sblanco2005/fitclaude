"""Tool definitions for the Coach agent (Claude tool_use format)."""

TOOL_DEFINITIONS = [
    {
        "name": "generate_workout",
        "description": (
            "Generate a workout routine for the user based on their equipment, goals, "
            "and history. Call this when the user wants a workout plan."
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
                    "description": "The type of workout to generate",
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
            },
            "required": ["workout_type"],
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
                "workout_id": {"type": "string"},
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
        "name": "log_workout_session",
        "description": (
            "Quickly log a completed workout session from shorthand input like "
            "'DL 295lb 3 reps 2 sets, bench 225 3x5, OHP 135 4x8'. "
            "Call this when the user reports exercises they just did with sets/reps/weight. "
            "Parse the shorthand and save it as a completed workout."
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
                    "description": "Infer the workout type from the exercises listed",
                },
                "workout_name": {
                    "type": "string",
                    "description": "Optional name for the session, e.g. 'Heavy Pull Day'",
                },
                "exercises": {
                    "type": "array",
                    "description": "List of exercises performed",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Exercise name (e.g. 'Deadlift', 'Bench Press')",
                            },
                            "sets": {
                                "type": "integer",
                                "description": "Number of sets",
                            },
                            "reps": {
                                "type": "string",
                                "description": "Reps per set (e.g. '5', '8-12', 'AMRAP')",
                            },
                            "weight_kg": {
                                "type": "number",
                                "description": "Weight in kg (convert from lb if needed: 1 lb = 0.4536 kg)",
                            },
                        },
                        "required": ["name", "sets", "reps"],
                    },
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Total session duration in minutes (optional)",
                },
                "notes": {
                    "type": "string",
                    "description": "Any notes the user mentioned about the session",
                },
            },
            "required": ["workout_type", "exercises"],
        },
    },
]
