# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

FitClaude — AI-powered fitness assistant with conversational workout generation, nutrition tracking, exercise variations, and activity logging. Next.js 16 + React 19 frontend, FastAPI + SQLAlchemy (async) backend, Anthropic Claude API for the AI agents.

## Commands

```bash
# Frontend (Next.js)
npm install
npm run dev              # http://localhost:3000

# Backend (FastAPI) — separate terminal
cd fitclaude-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000

# Seed exercises (35 exercises, 105 variations)
npx prisma db seed

# Quick boot test
python3 -c "from app.main import app; print('OK')"

# Deploy backend to VPS
# See .claude/skills/deploy-backend for full steps
```

## Architecture

```
app/                           # Next.js 16 frontend
  page.tsx                     # Dashboard (greeting, quick stats)
  chat/page.tsx                # Chat with Coach Fit
  workouts/page.tsx            # Routines, Hit It, History
  nutrition/page.tsx           # Meal logging, daily totals, history
  analytics/page.tsx           # Training/Nutrition analytics, muscles worked
  exercises/page.tsx           # Exercise library
  settings/page.tsx            # Profile, targets, equipment
  onboarding/page.tsx          # New user setup
  api/                         # Next.js API routes (profile, workouts, nutrition, analytics, chat proxy)

components/
  ui/                          # Design system (Card, Button, Badge, Modal, Input)
  analytics/                   # SummaryCards, MusclesWorkedCard, charts
  workout/anatomy/             # Arnold SVG anatomy (AnatomyFront, AnatomyBack, muscleData)

fitclaude-backend/app/
  main.py                      # FastAPI app, CORS, router registration
  config.py                    # Pydantic Settings (.env)
  database.py                  # Async SQLAlchemy engine (Neon PostgreSQL)
  agents/                      # AI agents
    __init__.py                # Agent registry (instantiates agents)
    base.py                    # BaseAgent ABC
    coach.py                   # Main orchestrator — Claude tool-use loop
    prompts.py                 # Coach system prompt + build_user_context()
    tools.py                   # Tool definitions (JSON schema for Claude)
    spicy.py                   # "Spicy" variation logic
    minimax_fallback.py        # MiniMax fallback for API errors
    nutrition/                 # Dedicated nutrition agent
      agent.py                 # NutritionAgent — extraction-only prompt
      prompts.py               # NUTRITION_SYSTEM_PROMPT
      schemas.py               # FoodItem Pydantic model
      known_foods.py           # Known foods dictionary + lookup
    workout/                   # Workout agent (placeholder, handled by coach)
  router/                      # Intent routing
    intent.py                  # detect_food_logging_intent()
    dispatcher.py              # route_message() → agent or general
  routers/                     # FastAPI route handlers
  models/                      # SQLAlchemy ORM models
  schemas/                     # Pydantic request/response schemas
  services/                    # Business logic (usage, youtube, etc.)
  jobs/                        # Background jobs (video linker)
```

## Key Design Decisions

- **Agent pattern**: Tool-use loop in `agents/coach.py`. Claude calls tools, results sent back, loop until text response. Dedicated nutrition agent fast-path for simple food logging (bypasses full tool-use loop).
- **Intent router**: `router/intent.py` detects food-logging messages and routes to the nutrition agent. Everything else goes through the general coach.
- **Spicy variations**: Two-level system — DB-defined variations first, rule-based fallback if none found.
- **Database**: Neon PostgreSQL via Prisma (frontend) and SQLAlchemy+asyncpg (backend). NEVER use SQLite. Python models must match Prisma schema exactly (CUID IDs, camelCase columns).
- **Auth**: NextAuth v5 beta with Google OAuth + database sessions.
- **Deployment**: Frontend on Vercel (auto-deploy on push). Backend on Hostinger VPS via systemd.

## Conventions

- SQLAlchemy models use `Mapped[]` with `mapped_column(name="camelCase")` to match Prisma column names.
- Pydantic schemas use `model_config = {"from_attributes": True}`.
- Agent model configurable via `AGENT_MODEL` env var (defaults to `claude-sonnet-4-20250514`).
- Tailwind v4: `@import "tailwindcss"` + `@theme inline` in CSS, `@utility` for custom utilities.
- Mobile-first design with bottom tab nav, glassmorphism cards, emerald primary color.

## UI Interactions

### Onboarding
1. Age, sex
2. Primary goal (fat loss / muscle gain / maintenance / recomp)
3. Experience level (beginner / intermediate / advanced)
4. Training frequency (days per week)
5. Gym type (home gym / public gym)
   - If home gym → enter available equipment
6. Injuries or limitations (optional)

### Workouts
- Routines list with collection groups, Hit It flow (start → 2hr auto-stop), history tab
- Quick routine logging via chat ("I did routine 26 this morning")
- Swap/Regenerate button on routine cards
- Delete activity history with confirmation popup

### Nutrition
- Chat-based food logging (dedicated nutrition agent for accuracy)
- Pencil icon to edit meals (no accidental edits)
- Close Day with confirmation popup
- Daily totals with macro breakdown

### Analytics
- Training/Nutrition tabs with period selector (7d, 30d, 90d, All)
- Muscles Worked card with Arnold anatomy (green=worked, red=missed)
- Personal records, volume tracking
