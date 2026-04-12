# FitClaude — Product Overview

> AI-powered fitness coaching platform with conversational workout generation, nutrition tracking, and training analytics.

---

## What Is FitClaude?

FitClaude is a mobile-first fitness app where the primary interface is a **conversational AI coach** ("Coach Fit"). Instead of tapping through menus, users tell the coach what they want in natural language — generate a workout, log a meal, ask about form — and the coach executes it through tool calls against the database.

The app combines:
- **Chat-driven workout generation** with equipment-aware exercise selection
- **Natural language nutrition logging** with vision photo analysis and barcode scanning
- **Progressive overload tracking** and training analytics
- **Exercise library** with 1,300+ exercises and "spicy" variation system
- **Tiered access** (free / pro / unlimited) with usage-based rate limiting

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Auth | NextAuth v5 (Google OAuth, database sessions) |
| Database | PostgreSQL (Neon), Prisma (frontend), SQLAlchemy async (backend) |
| Backend | Python FastAPI (AI agents only) |
| AI | Anthropic Claude API (Haiku for chat, Sonnet for vision) |
| Fallback | MiniMax API (when Anthropic rate-limited or down) |
| Deployment | Vercel (frontend), Hostinger VPS + systemd (backend) |

---

## Core Features

### 1. AI Coach (Chat)

Two-topic conversational agent powered by Claude with a tool-use loop.

**Workout topic:**
- Generates personalized routines via `generate_workout` tool (saves to DB, never just text)
- References recent workout history for progressive overload
- Enforces equipment constraints — home gym users only get exercises they can do
- Supports supersets with multiple pairing strategies (antagonist, compound+isolation, heavy+light, upper+lower)
- Logs external classes/activities from natural language ("I did Alpha Fit for an hour")
- Logs completion of existing routines ("I did routine 26 this morning") without re-entering exercises
- Imports exercises from YouTube video transcripts
- Suggests "spicy" variations when the user is bored

**Nutrition topic:**
- Parses food from natural language ("chicken burrito and a coke") into macros
- Dedicated nutrition agent fast-path bypasses the full tool-use loop for simple food logging
- Vision photo analysis (Pro/Unlimited) — identifies multiple items on a plate, estimates portions
- Barcode scanning via Open Food Facts database
- Branded food recognition — logs common products immediately without 5 rounds of questions
- Single-call consolidation — multiple items in one message always become one log entry

**Coach personality:**
- Encouraging gym buddy, not Instagram influencer
- Celebrates PRs, calls out sandbagging
- Takes injuries/fatigue seriously and adjusts immediately
- Stays in its lane — deflects non-fitness questions with gym-bro humor
- Never lectures about macros — just logs and moves on unless asked for advice

### 2. Workouts

**Routine library:**
- Browse, search, filter, and favorite saved routines
- Filter by workout type (push/pull/legs/upper/lower/full body/cardio/custom), completion status, date
- Organize into collections with emoji and color (e.g., "Push/Pull/Legs", "Alpha Fit")

**"Hit It" active workout flow:**
- Large focused exercise card with form cues from the AI
- Set-by-set logging: weight (lb/kg toggle), reps, RIR (reps in reserve)
- Rest timer with visual + audio alerts
- Inline set history from previous sessions
- Superset visual grouping (A1/A2, B1/B2)
- Completion: fatigue rating (1-10) + optional notes

**Management:**
- Clone routines, swap/regenerate exercises via chat
- Delete activity history with confirmation (never deletes routine templates)
- 2-hour auto-stop for abandoned workouts

### 3. Nutrition

**Daily view:**
- Calorie ring (circular progress vs. target, color shifts when over)
- Macro pills (protein/carbs/fat progress bars with gram targets)
- Chronological meal list with meal type emoji, raw description, and expandable macros

**Logging methods:**
1. Chat — natural language to the nutrition agent
2. Barcode scanner — camera detection → Open Food Facts lookup → log
3. Photo upload — Claude Sonnet vision analysis (Pro/Unlimited)
4. Nutrition label photo — extracts exact values from packaging

**Editing:**
- Pencil icon to edit any logged meal (no accidental edits)
- Modify raw text, meal type, calories, all macros
- "Close Day" with confirmation popup

### 4. Analytics

Two-tab system (Training / Nutrition) with period selector (7d, 30d, 90d, All Time).

**Training analytics:**
- Summary cards: total workouts, total volume, avg volume per session
- Muscles worked heatmap (Arnold anatomy SVG — green = worked, red = missed)
- Volume trend chart (weekly progression)
- Progressive overload chart (max weight per compound lift over time)
- Personal records (all-time max per exercise)
- Plateau alerts (same max weight for 3+ sessions → suggests variation or deload)
- Rep range distribution (strength 1-5, hypertrophy 6-12, endurance 13+)

**Nutrition analytics:**
- Days logged, average daily calories/protein/carbs/fat
- Calorie trend chart vs. target line
- Stacked macro chart (daily protein/carbs/fat)
- Compliance cards (% of days meeting calorie target, % meeting protein target)
- Meal pattern distribution (breakfast/lunch/dinner/snack frequency)

### 5. Exercise Library

- 1,300+ exercises imported from ExerciseDB API with animated GIF demonstrations
- Filter by muscle group, exercise type, difficulty
- Search by name
- Each exercise shows: muscle group, equipment required, difficulty, instructions

**Spicy variations system:**
- 3 spice levels per exercise (mild → advanced)
- 8 modification types: tempo, grip, stance, load curve, intensity, angle, unilateral, pause
- DB-defined variations checked first, rule-based fallback if none found
- Examples: tempo bench press (3-1-1-0), close-grip bench, paused squat, deficit deadlift

### 6. Onboarding

6-step wizard for new users:
1. Sex
2. Primary goal (fat loss / muscle gain / maintenance / recomp)
3. Experience level (beginner / intermediate / advanced)
4. Training frequency (days per week)
5. Gym type (home → enter equipment, or public gym)
6. Injuries or limitations (optional)

### 7. Settings

- Profile: name, fitness goal, experience level
- Weight unit toggle (lb / kg)
- Gym type + equipment text (home gym)
- Nutrition targets: daily calories, daily protein, carbs/fat % split with computed gram targets
- Injuries & notes for the coach

---

## Architecture

### Agent Pattern

The core AI loop lives in `fitclaude-backend/app/agents/coach.py`:

1. User message arrives via Next.js API route → proxied to FastAPI
2. Intent router checks if it's a simple food log → routes to dedicated nutrition agent (fast path)
3. Everything else goes to the general coach agent
4. Coach receives: system prompt + user context (equipment, goals, targets) + conversation history + tools
5. Claude responds with tool calls → executed against DB → results sent back → loop until text response
6. Response returned with metadata (workout_id, nutrition_log_id, model used)

### Equipment Enforcement (Two-Layer)

**Layer 1 — Pre-filter (system prompt):**
For home gym users, the backend queries all exercises, filters by user equipment, and injects an `AVAILABLE EXERCISES` list into the system prompt grouped by muscle. The coach is instructed to only pick from this list.

**Layer 2 — Post-filter (tool execution):**
When `generate_workout` runs, each exercise is validated against the user's equipment. Exercises requiring equipment the user doesn't have are rejected, and the coach is told to suggest replacements.

### Data Flow

```
User (Next.js) → API Route → FastAPI → Claude API → Tool Calls → PostgreSQL
                                ↑                         ↓
                          System Prompt              Tool Results
                    (user context, equipment,      (saved to DB)
                     available exercises)
```

---

## Data Models

| Model | Purpose |
|-------|---------|
| User | Profile, fitness goals, equipment, nutrition targets, tier |
| Exercise | 1,300+ exercises with muscle group, equipment, GIF URL |
| ExerciseVariation | Spicy modifications (tempo, grip, stance, etc.) |
| Workout | Generated routines with type, category, source, completion status |
| WorkoutExercise | Exercises within a workout (sets, reps, weight, set logs, superset group) |
| WorkoutCollection | User-created routine groupings with emoji/color |
| NutritionLog | Individual meals with raw input, parsed macros, meal type |
| DailyNutritionSummary | Precomputed daily totals |
| Activity | External classes/activities (name, duration, notes) |
| ConversationHistory | Chat context per topic (workout/nutrition) |
| ExerciseVideo | YouTube tutorial links with admin approval workflow |
| TokenUsage | API cost tracking per user per endpoint |
| UserUsageLimit | Rate limiting config per tier |

---

## Tier System

| Feature | Free | Pro | Unlimited |
|---------|------|-----|-----------|
| Chat (workout + nutrition) | Yes | Yes | Yes |
| Workout generation | Yes | Yes | Yes |
| Nutrition logging | Yes | Yes | Yes |
| Analytics | Yes | Yes | Yes |
| Vision photo analysis | No | Yes | Yes |
| Rate limits | Strict | Higher | None |
| AI model | Haiku | Haiku | Haiku |

All tiers use the same AI model — tier differences are in rate limits and feature gates (vision).

---

## What Makes It Different

1. **Chat-first UX** — No form-filling. Tell the coach what you did, what you want, or snap a photo. The AI handles parsing, logging, and database writes.
2. **Equipment-aware generation** — Home gym users get a hard-filtered exercise pool. The coach literally cannot suggest a cable crossover if you don't have cables.
3. **Spicy variations** — A structured system for making exercises progressively harder/more interesting without changing the exercise itself.
4. **Two-agent architecture** — Dedicated nutrition agent for fast food logging (skips the full tool-use loop), general coach for everything else.
5. **Arnold anatomy visualization** — SVG muscle map showing which muscles you've trained (green) and which you're neglecting (red) over any time period.
