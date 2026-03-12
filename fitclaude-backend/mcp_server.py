"""FitClaude MCP Server — exposes exercise and nutrition tools for Claude Desktop."""

import asyncio
import json
import os
import sys
from datetime import date, datetime, timezone

# Ensure app/ imports work regardless of launch directory
_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)
os.chdir(_dir)  # So pydantic-settings finds .env

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from cuid2 import Cuid

from app.database import async_session
from app.models.exercise import Exercise, ExerciseVariation
from app.models.nutrition import NutritionLog
from app.services import exercise_service, nutrition_service

USER_ID = os.environ.get("FITCLAUDE_USER_ID", "")
if not USER_ID:
    print("ERROR: FITCLAUDE_USER_ID environment variable is required", file=sys.stderr)
    sys.exit(1)

cuid_gen = Cuid()
server = Server("fitclaude")


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _exercise_to_dict(ex: Exercise) -> dict:
    return {
        "id": ex.id,
        "name": ex.name,
        "muscle_group": ex.muscle_group,
        "secondary_muscles": ex.secondary_muscles,
        "equipment_required": ex.equipment_required,
        "difficulty": ex.difficulty,
        "exercise_type": ex.exercise_type,
        "instructions": ex.instructions,
        "variations": [
            {
                "id": v.id,
                "name": v.name,
                "spicy_level": v.spicy_level,
                "modification_type": v.modification_type,
                "description": v.description,
            }
            for v in (ex.variations or [])
        ],
    }


def _nutrition_log_to_dict(log: NutritionLog) -> dict:
    return {
        "id": log.id,
        "date": str(log.date),
        "meal_type": log.meal_type,
        "raw_input": log.raw_input,
        "calories": log.calories,
        "protein_g": log.protein_g,
        "carbs_g": log.carbs_g,
        "fat_g": log.fat_g,
        "fiber_g": log.fiber_g,
    }


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

TOOLS = [
    Tool(
        name="search_exercises",
        description="Search exercises by name. Returns matching exercises with their variations.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term (e.g. 'bench press', 'squat', 'curl')",
                },
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="list_exercises_by_muscle",
        description="List all exercises for a given muscle group, optionally filtered by available equipment.",
        inputSchema={
            "type": "object",
            "properties": {
                "muscle_group": {
                    "type": "string",
                    "description": "Muscle group (e.g. 'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core')",
                },
                "equipment": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Available equipment to filter by (e.g. ['barbell', 'dumbbells', 'bench'])",
                },
            },
            "required": ["muscle_group"],
        },
    ),
    Tool(
        name="create_exercise",
        description="Add a new exercise to the database.",
        inputSchema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Exercise name"},
                "muscle_group": {
                    "type": "string",
                    "description": "Primary muscle group",
                },
                "exercise_type": {
                    "type": "string",
                    "description": "compound or isolation",
                    "default": "compound",
                },
                "equipment_required": {
                    "type": "string",
                    "description": "Equipment needed (e.g. 'barbell, bench')",
                },
                "difficulty": {
                    "type": "string",
                    "description": "beginner, intermediate, or advanced",
                    "default": "intermediate",
                },
                "instructions": {
                    "type": "string",
                    "description": "How to perform the exercise",
                },
                "secondary_muscles": {
                    "type": "string",
                    "description": "Secondary muscles worked",
                },
            },
            "required": ["name", "muscle_group"],
        },
    ),
    Tool(
        name="log_nutrition",
        description="Log a food entry with macros. Use this to track meals throughout the day.",
        inputSchema={
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "What was eaten (e.g. '200g chicken breast with rice')",
                },
                "calories": {"type": "number", "description": "Total calories"},
                "protein_g": {"type": "number", "description": "Protein in grams"},
                "carbs_g": {"type": "number", "description": "Carbs in grams"},
                "fat_g": {"type": "number", "description": "Fat in grams"},
                "meal_type": {
                    "type": "string",
                    "description": "breakfast, lunch, dinner, snack, pre_workout, or post_workout",
                    "default": "snack",
                },
                "fiber_g": {"type": "number", "description": "Fiber in grams"},
            },
            "required": ["description", "calories", "protein_g", "carbs_g", "fat_g"],
        },
    ),
    Tool(
        name="get_daily_nutrition",
        description="Get nutrition totals for today or a specific date. Shows all meals and macro totals.",
        inputSchema={
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format (defaults to today)",
                },
            },
        },
    ),
    Tool(
        name="get_nutrition_history",
        description="Get nutrition logs for the past N days.",
        inputSchema={
            "type": "object",
            "properties": {
                "days_back": {
                    "type": "integer",
                    "description": "Number of days to look back (default 7)",
                    "default": 7,
                },
            },
        },
    ),
]


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        async with async_session() as db:
            if name == "search_exercises":
                result = await _search_exercises(db, arguments)
            elif name == "list_exercises_by_muscle":
                result = await _list_exercises_by_muscle(db, arguments)
            elif name == "create_exercise":
                result = await _create_exercise(db, arguments)
            elif name == "log_nutrition":
                result = await _log_nutrition(db, arguments)
            elif name == "get_daily_nutrition":
                result = await _get_daily_nutrition(db, arguments)
            elif name == "get_nutrition_history":
                result = await _get_nutrition_history(db, arguments)
            else:
                result = {"error": f"Unknown tool: {name}"}
        return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def _search_exercises(db, args: dict) -> dict:
    query = args["query"]
    exercises = await exercise_service.search_exercises(db, query)
    return {
        "count": len(exercises),
        "exercises": [_exercise_to_dict(ex) for ex in exercises],
    }


async def _list_exercises_by_muscle(db, args: dict) -> dict:
    muscle_group = args["muscle_group"]
    equipment = args.get("equipment")
    exercises = await exercise_service.get_exercises_by_muscle(db, muscle_group, equipment)
    return {
        "muscle_group": muscle_group,
        "count": len(exercises),
        "exercises": [_exercise_to_dict(ex) for ex in exercises],
    }


async def _create_exercise(db, args: dict) -> dict:
    exercise = Exercise(
        id=cuid_gen.generate(),
        name=args["name"],
        muscle_group=args["muscle_group"],
        exercise_type=args.get("exercise_type", "compound"),
        equipment_required=args.get("equipment_required"),
        difficulty=args.get("difficulty", "intermediate"),
        instructions=args.get("instructions"),
        secondary_muscles=args.get("secondary_muscles"),
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return {
        "created": True,
        "id": exercise.id,
        "name": exercise.name,
        "muscle_group": exercise.muscle_group,
    }


async def _log_nutrition(db, args: dict) -> dict:
    now = datetime.utcnow()
    log = NutritionLog(
        id=cuid_gen.generate(),
        user_id=USER_ID,
        date=now,
        meal_type=args.get("meal_type", "snack"),
        raw_input=args["description"],
        calories=args["calories"],
        protein_g=args["protein_g"],
        carbs_g=args["carbs_g"],
        fat_g=args["fat_g"],
        fiber_g=args.get("fiber_g"),
    )
    db.add(log)
    await db.commit()

    # Return daily totals after logging
    daily = await nutrition_service.get_daily_nutrition(db, USER_ID, now.date())
    return {
        "logged": True,
        "entry": {
            "description": args["description"],
            "calories": args["calories"],
            "protein_g": args["protein_g"],
            "carbs_g": args["carbs_g"],
            "fat_g": args["fat_g"],
            "meal_type": args.get("meal_type", "snack"),
        },
        "daily_totals": {
            "calories": daily["total_calories"],
            "protein_g": daily["total_protein_g"],
            "carbs_g": daily["total_carbs_g"],
            "fat_g": daily["total_fat_g"],
        },
    }


async def _get_daily_nutrition(db, args: dict) -> dict:
    target_date = None
    if "date" in args and args["date"]:
        target_date = date.fromisoformat(args["date"])
    return await nutrition_service.get_daily_nutrition(db, USER_ID, target_date)


async def _get_nutrition_history(db, args: dict) -> dict:
    days_back = args.get("days_back", 7)
    logs = await nutrition_service.get_nutrition_logs(db, USER_ID, days_back)
    return {
        "days_back": days_back,
        "count": len(logs),
        "logs": [_nutrition_log_to_dict(log) for log in logs],
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
