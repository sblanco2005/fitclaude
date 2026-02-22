# FitClaude

AI-powered personal fitness assistant. Chat with Claude to generate workouts, log meals, track macros, and get exercise variations — all through natural language.

## Features

- **AI Coach Chat** — Persistent chat on every page. Ask for workouts, log meals, get exercise tips
- **Workout Generation** — Custom routines: push/pull/legs, full body, HIIT, cardio. Supports spicy variations (tempo, grip, stance changes)
- **Nutrition Tracking** — Log meals in plain English ("2 eggs and oatmeal"). Claude estimates macros automatically
- **Exercise Library** — 35+ exercises with 3 spicy variations each. YouTube tutorial videos linked per exercise
- **Hit It Workflow** — Start a routine, log sets in real-time, auto-complete after 2 hours
- **YouTube Video Pipeline** — Auto-discover tutorials and reference videos. Admin approve/reject workflow
- **Equipment Validation** — Home gym users only get exercises matching their equipment
- **Spin Routines** — One-tap regenerate a routine with different exercises, same muscle focus

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind v4 |
| Auth | NextAuth v5 (Google OAuth, database sessions) |
| Database | PostgreSQL (Neon) via Prisma 5 |
| AI Backend | Python FastAPI + Anthropic Claude (tool-use loop) |
| Design | Dark theme, glass-morphism, mobile-first bottom nav |

## Architecture

```
FitClaude/                        Next.js frontend
  app/                            Pages + API routes
  components/                     UI components (Card, Badge, Modal, ChatDrawer)
  context/FitClaudeContext.tsx     Global state: chat, profile, data sync
  auth.ts                         NextAuth v5 config
  prisma/schema.prisma            14 database models
  lib/auth/middleware.ts           withAuth() wrapper for API routes

fitclaude-backend/                Python FastAPI backend (AI services only)
  app/agent/coach.py              Claude tool-use loop orchestrator
  app/agent/tools.py              Tool definitions (generate_workout, log_nutrition, etc.)
  app/agent/spicy.py              Spicy variation logic (DB + rule-based fallback)
  app/services/                   YouTube, exercise, nutrition services
  app/jobs/                       Background jobs (video discovery, video linking)
```

The Next.js app handles all CRUD directly against Neon via Prisma. The Python backend is only called for AI chat (Claude tool-use loop), YouTube video import, and spicy variations.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — greeting, today's macros, recent workouts |
| `/workouts` | Routine list, detail view, Hit It timer, set logging |
| `/nutrition` | Today's macros + meal list, daily history |
| `/exercises` | Exercise library with search, filters, YouTube videos |
| `/chat` | Full-page chat |
| `/settings` | Edit profile, targets, equipment, sign out |
| `/admin` | Video review, bulk approve/reject, job triggers |
| `/onboarding` | 6-step wizard (age, goal, experience, schedule, gym setup, injuries) |

## Database Models

| Model | Purpose |
|---|---|
| User | Auth + fitness profile (goal, experience, gym type, equipment, targets) |
| Exercise | Library entries (name, muscle group, equipment, difficulty) |
| ExerciseVariation | Spicy variations per exercise (3 levels) |
| Workout | AI-generated routines (type, category, display ID) |
| WorkoutExercise | Exercises in a workout (sets, reps, rest, set logs) |
| NutritionLog | Per-meal entries (raw input, parsed macros) |
| DailyNutritionSummary | Aggregated daily macro totals |
| ConversationHistory | Chat messages per topic (workout/nutrition) |
| ExerciseVideo | YouTube videos linked to exercises (tutorial/reference) |
| PendingExercise | Exercises discovered from YouTube, awaiting review |
| ApiToken | Mobile auth tokens (iOS app) |

## AI Tools (Claude)

| Tool | What it does |
|---|---|
| `generate_workout` | Creates full routine with exercises, sets/reps, rest, coaching tips |
| `log_nutrition` | Parses food description, estimates macros, stores entry |
| `get_workout_history` | Fetches recent workouts for progressive overload context |
| `get_daily_nutrition` | Gets macro totals for a date |
| `get_spicy_variation` | Returns a harder exercise variation (levels 1-3) |
| `mark_workout_complete` | Marks workout done with fatigue rating |
| `parse_youtube_video` | Extracts exercises from YouTube transcript |

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (Neon recommended)
- Google OAuth credentials
- Anthropic API key
- YouTube Data API v3 key

### Frontend

```bash
npm install

# Create .env.local with:
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db
AUTH_SECRET=<random-secret>
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=<from-google-cloud>
GOOGLE_CLIENT_SECRET=<from-google-cloud>
FITCLAUDE_BACKEND_URL=http://localhost:8000
JOB_API_KEY=<shared-secret>

# Push schema + seed exercises
npm run db:push
npm run db:seed

# Start
npm run dev
```

### Python Backend

```bash
cd fitclaude-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create .env with:
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.neon.tech/db
AGENT_MODEL=claude-sonnet-4-20250514
YOUTUBE_API_KEY=<youtube-data-api-key>
JOB_API_KEY=<same-shared-secret>

# Start
uvicorn app.main:app --reload --port 8000
```

> **Note:** The Python `DATABASE_URL` must use `postgresql+asyncpg://` scheme. Strip `sslmode` and `channel_binding` params from the Neon URL — asyncpg handles SSL via `connect_args`.

### Database Commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema to DB
npm run db:seed       # Seed 35 exercises + 105 variations
npm run db:studio     # Open Prisma Studio
```

## Deployment

### Frontend — Vercel

Set these environment variables in Vercel:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL URL |
| `AUTH_SECRET` | Random secret |
| `AUTH_TRUST_HOST` | `true` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FITCLAUDE_BACKEND_URL` | Fly.io backend URL |
| `JOB_API_KEY` | Shared secret for job auth |

Build command is `prisma generate && next build` (already configured).

### Backend — Fly.io

```bash
cd fitclaude-backend
fly launch
fly secrets set ANTHROPIC_API_KEY=... DATABASE_URL=... YOUTUBE_API_KEY=... JOB_API_KEY=...
fly deploy
```

Point `FITCLAUDE_BACKEND_URL` on Vercel to `https://your-app.fly.dev`.

## License

Private project.
