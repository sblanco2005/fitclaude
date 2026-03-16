# Workout Coach Agent — Implementation Spec

## Overview

Coach Fit is the main AI agent in FitClaude. It handles workout generation, exercise variations, activity logging, routine completion, and progressive overload tracking via a Claude tool-use loop.

**Model:** Configurable via `AGENT_MODEL` env var (default: `claude-sonnet-4-20250514`). Falls back to MiniMax on transient Anthropic errors.

---

## Architecture

```
User message (from Next.js → FastAPI /api/chat)
        ↓
   handle_chat() — agents/coach.py
        ↓
   Intent check: food logging? → nutrition agent fast path (see nutrition/ SPEC)
        ↓ (no)
   Load user context (profile, equipment, goals, targets)
   Load conversation history (last 14 messages for workout topic)
        ↓
   Build Claude request:
     - System: COACH_SYSTEM_PROMPT + USER CONTEXT
     - Messages: conversation history + new message
     - Tools: 10 tool definitions (cached)
        ↓
   Claude API call (Sonnet by default)
        ↓
   Tool-use loop:
     while stop_reason == "tool_use":
       Execute each tool call → get result
       Send tool results back to Claude
       Claude responds with more tool calls or final text
        ↓
   Safety nets (if tools were skipped):
     - Nutrition: forced retry with explicit "call log_nutrition NOW"
     - Workout: parse exercises from text response, auto-save
        ↓
   Return response text + workout_id + nutrition_log_id
```

---

## Tools (10 total)

### 1. `generate_workout`
**Purpose:** Create and save a structured workout routine.

**Input:**
- `workout_type`: push, pull, legs, upper, lower, full_body, cardio, custom
- `category`: lifting, hiit, cardio, mobility, calisthenics, sport
- `name`: Descriptive name (e.g., "Push Day – Chest & Shoulders")
- `exercises[]`: Array with name, muscle_group, sets, reps, rest_seconds, notes, superset_group
- `spicy_level`: 0–3
- `source`: "coach" (AI-generated) or "manual" (user-logged external workout)

**Process:**
1. Load user profile for equipment validation
2. Get next `display_id` (sequential per user)
3. For each exercise:
   - Match against exercise DB (4-strategy matching: exact → normalized → word-set → substring)
   - If home gym: validate equipment requirements, reject incompatible exercises
   - If not in DB: auto-add to exercise library
   - Auto-search YouTube for tutorial videos
4. Save Workout + WorkoutExercise records
5. Return display_number, exercise count, equipment warnings

**Equipment Enforcement (home gym only):**
- Parses `equipment_text` into canonical keywords (barbell, dumbbells, bench, rack, cables, bands, pull-up bar, smith machine, etc.)
- Compound terms preserved: "smith machine" ≠ "machine", "cable machine" ≠ "machine"
- DB-matched exercises checked via `equipment_required` field
- Unmatched exercises checked via name-based keyword heuristics (machine_kw, cable_kw lists)
- Rejected exercises returned with reasons; coach told to suggest replacements

### 2. `log_activity`
**Purpose:** Log generic activities without exercise details (classes, cardio, sports).

**Input:** name (required), duration_minutes, notes

**Output:** Activity record in Activities tab.

### 3. `log_nutrition`
**Purpose:** Log food with macros.

**Input:** raw_text, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g

**Process:**
1. Sanitize raw_text (strip XML tags Claude sometimes injects)
2. **Call the dedicated nutrition agent** (`nutrition_agent.extract_and_validate(raw_text)`) to get accurate macro extraction — this overrides whatever Claude estimated in the tool call parameters
3. If the nutrition agent fails, fall back to Claude's original estimates
4. Create NutritionLog record, compute daily totals

**Why:** Claude's inline macro estimates (passed as tool params) are often inaccurate — wrong quantities, inflated numbers. The nutrition agent uses a specialized extraction prompt with few-shot examples, Pydantic validation, and known-foods overrides, producing consistently better results. This ensures the same accuracy whether the user logs food via:
- The fast path (intent router → nutrition agent directly)
- The coach tool-use loop (Claude calls log_nutrition → nutrition agent internally)

### 4. `get_workout_history`
**Purpose:** Retrieve recent workouts for progressive overload tracking.

**Input:** days_back (default 14), optional workout_type filter.

**Output:** List of workouts with display_number, date, type, name, completed status, fatigue_rating, exercise_count.

### 5. `get_daily_nutrition`
**Purpose:** Get nutrition totals for a date. Timezone-aware (user's midnight-to-midnight).

### 6. `get_spicy_variation`
**Purpose:** Get a variation of an exercise to keep workouts fresh.

**Two-level system:**
1. **Database lookup** (fast, no API call): Check `ExerciseVariation` table by base exercise + spicy_level
2. **Rule-based fallback**: Pick from `MODIFICATION_TYPES` dict:
   - **Tempo**: Slow eccentrics, pauses, extended ranges
   - **Grip**: Wide/close/mixed variations
   - **Stance**: Staggered/unilateral/elevated
   - **Load curve**: Pauses, 1.5 reps, mechanical drops
   - **Intensity**: Failure sets, drop sets, cluster sets

**Spicy levels:** 0 = standard, 1 = mild, 2 = moderate, 3 = intense

### 7. `mark_workout_complete`
**Purpose:** Mark a workout as done with fatigue rating (1–10).

### 8. `log_routine_done`
**Purpose:** Clone an existing routine to history as a completed session. The template stays intact.

**Matching logic:**
1. Try display_id match (e.g., "routine 26" → display_id=26)
2. Fallback: case-insensitive partial name match
3. Last resort: word-level matching

**Process:** Clone Workout + all WorkoutExercise records, set completed=True, assign fatigue_rating and notes.

### 9. `lookup_user_foods`
**Purpose:** Check user's personal food DB for known macros before estimating.

**Output:** Per-serving macros for found foods, list of not-found foods.

### 10. `parse_youtube_video`
**Purpose:** Extract exercises from a YouTube video transcript and add to exercise library.

---

## System Prompt

**File:** `agents/prompts.py`

### Personality
- Experienced gym buddy, not Instagram influencer
- Casual, direct language
- Celebrates PRs and consistency
- Takes injuries/fatigue seriously
- Likes making workouts interesting with "spicy" variations

### Critical Rules (21 total)

1. **Equipment enforcement** — NEVER suggest exercises the user can't do with their equipment
2. **Progressive overload** — Reference recent history when generating workouts
3. **Nutrition logging** — One log_nutrition call per message, all items combined, quantity defaults to 1
4. **Injuries** — Ask clarifying questions before modifying workouts
5. **Exercise count** — 4–7 exercises unless user specifies otherwise
6. **Spicy variations** — Use get_spicy_variation when user is bored
7. **Fatigue tracking** — If fatigue 7+, suggest deload
8. **Must call generate_workout** — Never just list exercises as text
9. **YouTube import** — Use parse_youtube_video for shared links
10. **Equipment prompting** — Ask home gym users with no equipment what they have
11. **Must call log_nutrition** — Text responses don't save food
12. **Recreate workouts** — Must call generate_workout, not paste text
13. **No internal IDs** — Use display_number (e.g., "Routine #5")
14. **No hallucinated tool results** — Always call the actual tool
15. **Stay in lane** — Fitness/nutrition only, deflect with humor
16. **Never invent macro targets** — Only use USER CONTEXT values
16b. **Branded foods** — Just log with best guess, don't ask 5 questions
17. **Chill nutrition tone** — Confirm + totals, no lecturing
18. **Food database first** — Call lookup_user_foods before estimating
19. **Nutrition label photos** — Extract exact values from image
20. **Cardio/workout images** — Extract metrics, call log_activity
21. **External workouts** — Route to correct tool immediately (log_routine_done / generate_workout / log_activity)

### Superset Strategies

Always include 1–2 superset pairs per routine. Four strategies:
1. **Antagonist pairs** — chest+back, biceps+triceps, quads+hamstrings
2. **Compound + bodyweight** — bench press + push-ups, rows + band pull-aparts
3. **Heavy + light same-muscle** — bench + flyes, deadlifts + hip thrusts
4. **Upper + lower** — pull-ups + leg curls, shoulder press + calf raises

**Implementation:** `superset_group` field ("A", "B", etc.) on exercises. Same letter = paired. First exercise rest=0, second exercise rest=60-90s.

---

## User Context Injection

**Function:** `build_user_context()` in `agents/prompts.py`

Injected as second system block (after COACH_SYSTEM_PROMPT). Includes:
- Today's date + timezone
- Name, goal, experience level, gym type
- Injuries/notes, weight
- Nutrition targets (calories, protein, carbs, fat) — shows "not set" if missing
- Equipment list (for home gym) or "Full commercial gym" (for public gym)

---

## Safety Nets

### Nutrition Safety Net
If topic == "nutrition" AND user mentioned food AND model didn't call log_nutrition:
- Append forced instruction: "You did NOT call log_nutrition. Call it NOW."
- Retry once with same tools
- Process any tool calls from retry

### Workout Safety Net
If topic == "workout" AND user asked for a workout AND model didn't call generate_workout:
- Parse exercises from Claude's text response using regex patterns
- If ≥3 exercises found, auto-save via `_tool_generate_workout()`
- Detects past-tense ("I did", "this morning") → sets source="manual"

### Exercise Text Parsing
Two regex patterns for extracting exercises from text:
- **Pattern A:** "Exercise Name — 4 × 8-10 reps (2 min rest)" (weight-lifting style)
- **Pattern B:** "Exercise Name – 3 sets x 12" (simpler format)

---

## Rate Limiting & Model Selection

- `check_rate_limit()` — per-user limits based on tier
- `get_model_for_tier()` — free/pro/unlimited tiers get different models
- Token usage logged per request via `log_token_usage()`
- Prompt caching: system prompt block + last tool definition have `cache_control: ephemeral`

---

## Fallback: MiniMax

**File:** `agents/minimax_fallback.py`

When Anthropic API returns transient errors (not 401/403):
- Falls back to MiniMax API for text-only response
- No tool use available in fallback mode
- Image requests skip fallback (MiniMax can't handle images)

---

## Exercise Matching Algorithm

**Function:** `_match_exercise()` — 4-strategy cascading match:

1. **Exact match** — case-insensitive string comparison
2. **Normalized match** — strip parenthetical (e.g., "Lateral Raise (Dumbbells)" → "Lateral Raise"), collapse spaces
3. **Word-set overlap** — require ≥80% of smaller word-set contained in larger (handles word-order differences)
4. **Substring match** — DB name contains input or vice versa

If no match found, exercise is auto-added to the library and a YouTube tutorial is auto-linked.

---

## Equipment Parsing

**Function:** `_parse_user_equipment()`

Parses free-text equipment string into canonical keywords:
- Handles aliases: "db" → "dumbbells", "bb" → "barbell", "pullup bar" → "pull-up bar"
- Compound terms: "smith machine", "cable machine", "row machine" preserved as distinct from standalone "machine"
- Special handling: "smith machine" → own canonical type (NOT "machine")

---

## Conversation History

- Loaded per topic: 8 messages for nutrition, 14 for workout
- Ordered ascending (oldest first)
- Saved by Next.js frontend (Prisma), read by Python backend (SQLAlchemy)

---

## Database Models

- **Workout** — id (CUID), user_id, date, name, workout_type, category, source, completed, fatigue_rating, duration_minutes, notes, display_id
- **WorkoutExercise** — id, workout_id, exercise_id, order, sets, reps, weight_kg, rest_seconds, notes (pipe-delimited: name|muscleGroup|tip), superset_group, was_spicy
- **Exercise** — id, name, muscle_group, difficulty, exercise_type, equipment_required
- **ExerciseVariation** — id, base_exercise_id, spicy_level, name, description
- **Activity** — id, user_id, name, duration_minutes, date, notes

---

## File Map

```
agents/
├── coach.py              # Main orchestrator (handle_chat + all tool handlers)
├── prompts.py            # COACH_SYSTEM_PROMPT + build_user_context()
├── tools.py              # 10 tool definitions (JSON schema for Claude)
├── spicy.py              # Spicy variation logic (DB + rule-based fallback)
├── minimax_fallback.py   # MiniMax fallback handler
├── workout/
│   ├── __init__.py       # Placeholder (coach.py handles everything currently)
│   └── WORKOUT_COACH_SPEC.md  # This file
```

---

## Future Extraction Plan

Currently the workout agent logic lives entirely in `coach.py`. A future refactor could extract it into `workout/agent.py` similar to how the nutrition agent was extracted, with:
- Dedicated workout generation prompt (narrower than the general coach)
- Equipment validation as a standalone service
- Exercise matching as a standalone service
- Separate tool handlers per domain

This would make `coach.py` a thin router that dispatches to specialized agents.
