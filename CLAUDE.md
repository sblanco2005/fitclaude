# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FitClaude — an AI-powered fitness assistant with conversational workout generation, nutrition tracking, and "spicy" exercise variation logic. Built with FastAPI + SQLAlchemy (async) backend, Anthropic Claude API for the agent, and Streamlit chat frontend.

## Commands

```bash
# Setup (first time)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then add your ANTHROPIC_API_KEY

# Seed the exercise database (35 exercises, 105 variations)
python -m backend.seed.seed_db

# Run the FastAPI backend
uvicorn backend.main:app --reload

# Run the Streamlit frontend (separate terminal)
streamlit run frontend/app.py

# Quick import/boot test
python -c "from backend.main import app; print('OK')"
```

## Architecture

```
backend/
  main.py              # FastAPI app, lifespan, CORS, router registration
  config.py            # Pydantic Settings (reads .env)
  database.py          # Async SQLAlchemy engine, session, Base, init_db()
  models/              # SQLAlchemy ORM models (User, Equipment, Exercise, ExerciseVariation,
                       #   Workout, WorkoutExercise, NutritionLog, ConversationHistory)
  schemas/             # Pydantic request/response schemas
  routers/             # FastAPI route modules: chat, users, equipment, workouts, nutrition, exercises
  agent/               # AI agent core
    coach.py           # Main orchestrator — handles Claude API tool-use loop
    prompts.py         # System prompt + build_user_context() for context injection
    tools.py           # Tool definitions (JSON schema for Claude tool_use)
    spicy.py           # "Spicy" variation logic — DB lookup with rule-based fallback
  services/            # Business logic layer (workout_service, nutrition_service, exercise_service)
  seed/
    exercises.json     # 35 exercises across 11 muscle groups with 3 variations each
    seed_db.py         # Idempotent seed script

frontend/
  app.py               # Streamlit chat UI with sidebar (profile, equipment, daily nutrition)
```

## Key Design Decisions

- **Agent pattern**: Tool-use loop in `backend/agent/coach.py`. Claude calls tools (generate_workout, log_nutrition, get_spicy_variation, etc.), results are sent back, loop continues until text response.
- **Spicy variations**: Two-level system in `backend/agent/spicy.py` — database-defined variations first (fast, no API call), rule-based fallback from `MODIFICATION_TYPES` dict if none found.
- **Nutrition parsing**: The agent itself estimates macros via tool_use (calories, protein, carbs, fat are required tool params), then the tool stores them directly. No separate LLM call needed.
- **Database**: SQLite via aiosqlite for dev. Change `DATABASE_URL` in `.env` for PostgreSQL. All async with SQLAlchemy 2.0 mapped_column style.
- **Conversation history**: Stored in `conversation_history` table, last 20 messages loaded per chat request for context.

## Conventions

- All SQLAlchemy models use `Mapped[]` annotations with explicit SQL types for `date`/`datetime` columns (`Date`, `DateTime`) to avoid type inference issues.
- Pydantic schemas use `model_config = {"from_attributes": True}` for ORM compatibility.
- The agent model is configurable via `AGENT_MODEL` env var (defaults to `claude-sonnet-4-20250514`).


## UI Interactions (Sign-Up Process)
- On detecting a new user, prompt the following onboarding flow:
  1. Enter age, sex, height, and weight
  2. Select primary goal (fat loss / muscle gain / maintenance / recomp)
  3. Select training experience level (beginner / intermediate / advanced)
  4. Select training frequency (days per week)
  5. Select gym type (home gym / public gym)
     - 5a. If home gym → enter available equipment (barbell, dumbbells, pull-up bar, bench, rack, cables, bands, etc.)
  6. Any injuries or limitations (optional, free text)

## Global components
- The chat should be always present whether is workouts or nutrition you interact with everything in the app via the chat
- There needs to a very quickly way to log the routine that i just finished. i thinking like putting in the chat something quickly like DL (deadlifts) 295lb 3 reps 2 sets and then we store this information in the database with the timestamp then we will see that in the log when we check the same routine. 
## Workout page
- For the workout page, i need to see a list on the left scrollable of all the routines i created, i should be able to quicly chek the whole rutine. maybe you click on the routine and tells you what muscles they work and the detail of the workout and another section (like 3 sections) with the past workouts logs
When you select the routine you should have exactly the information that you suggested,I want to see all of it. Then additional called Hit It with i should be able to move the button from routine to hit it to indicate that the workout has started. then the routine will have a stop button that will indicate when  i finish the workout. while the routine is in Hit it, we will give the user 2 hours for them to move it to complete or back to routine or the app will automatically move it back 

## 
-ok let's crete an additional section/button to see all my single exercies and othe section to see videos (in general for back, biceps etc.. from you tube). When i import videos, you will be able to determine if it's a single exercise video or a video in general for a specific mucle group. The keys to determine that is in the title of the vidoe if it says the word "Exercises in plural" or "a number more than 1" or a generic word, "legs,chest etc..) then you will know are videos for a muscle grouo (back etc..)

-another feature in the videos section is to either approve, reject/ dismi. If i approve or Reject idon't want you to fetch it again, if i dismish we can fetch it again. 


lastly i want to be able to add an exercise manually and then run the video search to look for that especific scenario so i can add it to the list manually 