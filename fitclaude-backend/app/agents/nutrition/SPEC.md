# Nutrition Agent — Implementation Spec

## Overview

FitClaude needs a dedicated Nutrition Logging Agent that lives in the FastAPI backend. This agent handles all food logging requests with a specialized system prompt, replacing the current general-purpose Haiku handler for nutrition tasks.

**Problem:** The general conversational agent (Haiku) frequently misparses food inputs — logging wrong quantities (e.g., "1 nurri protein shake" → logs 2) or identifying food correctly but failing to actually persist the log entry.

**Solution:** A dedicated nutrition agent with a narrow, extraction-only system prompt, a validation layer, and a known-foods override dictionary.

---

## Architecture

```
User (Telegram/MCP/Frontend)
        ↓
   OpenClaw / MCP
        ↓
   FastAPI Backend
        ↓
   Intent Router ← NEW
    ↓            ↓
Food intent    Everything else
    ↓            ↓
Nutrition Agent ← NEW    General Haiku Agent (existing)
    ↓
Known Foods Lookup ← NEW (override AI macros for regulars)
    ↓
Pydantic Validation ← NEW
    ↓
PostgreSQL write (existing)
    ↓
Confirmation message back to user
```

---

## Components to Build

### 1. Nutrition System Prompt

Create a dedicated system prompt stored as a constant. This prompt must enforce:

- **Output format:** ONLY a JSON array of food item objects. No prose, no markdown fences, no explanation.
- **Default quantity = 1** unless the user explicitly provides a number.
- **Never infer quantity** from the food name (e.g., "protein shake" ≠ 2 scoops).
- **Parse multiple foods** from a single message into separate array items.
- **Never ask clarifying questions.** Log what was said; user can correct later.
- **Best-effort macro estimation** with an `estimated: true` flag when guessing.

**Output schema per item:**
```json
{
  "name": "string — cleaned up, title-cased",
  "quantity": "number — default 1",
  "unit": "string — serving, shake, scoop, slice, cup, oz, g, piece, bowl, plate, etc.",
  "calories": "number or null",
  "protein_g": "number or null",
  "carbs_g": "number or null",
  "fat_g": "number or null",
  "estimated": "boolean"
}
```

**Include these few-shot examples in the prompt:**

| User input | Expected output |
|---|---|
| `1 nurri protein shake` | 1x Nurri Protein Shake, shake |
| `2 eggs and toast` | 2x Eggs + 1x Toast |
| `chicken rice bowl from chipotle` | 1x Chipotle Chicken Rice Bowl, bowl |
| `just a coffee` | 1x Black Coffee, cup |
| `3 scoops whey protein with milk` | 3x Whey Protein (scoop) + 1x Milk (cup) |
| `protein shake` | 1x Protein Shake (quantity = 1, NOT 2) |
| `had a bagel with cream cheese and 2 slices of bacon` | 1x Bagel with Cream Cheese + 2x Bacon |

---

### 2. Intent Router

A function `detect_food_logging_intent(message: str) -> bool` that determines if a message should be routed to the nutrition agent instead of the general handler.

**Should match (route to nutrition agent):**
- Explicit logging phrases: "log", "track", "add" + food/meal/calories/macros
- Past tense eating: "ate", "had", "just had", "just ate", "consumed", "eating"
- Meal context: "for breakfast", "for lunch", "for dinner", "for snack"
- Quantity + food unit patterns: "2 eggs", "1 scoop", "3 slices"
- Known food product names: "nurri", "chipotle", "quest", "fairlife" (make this extensible)
- Common food items when stated without a question: "protein shake", "chicken breast", "oatmeal", "bagel"

**Should NOT match (keep in general handler):**
- Questions about food: "how to make", "what is", "calories in", "nutrition info"
- Recommendations: "what should I eat", "recommend", "suggest"
- Meal planning: "meal plan", "meal prep"
- Edit/delete requests: "delete log", "remove entry", "undo last"

Use regex patterns. Store patterns in lists so they're easy to extend.

---

### 3. Nutrition Agent Class

`NutritionAgent` class with:

- **Constructor:** Takes an `AsyncAnthropic` client and model string (default `claude-haiku-4-5-20251001`).
- **`extract_food_items(user_message: str) -> list[FoodItem]`:**
  - Calls Haiku with `NUTRITION_SYSTEM_PROMPT` as system, user message as user content.
  - Max tokens: 1024 (these are short responses).
  - Strips markdown fences if Haiku adds them despite the prompt.
  - Parses JSON. If model returns a dict instead of array, wraps it in a list.
  - Validates each item through the Pydantic `FoodItem` model.
  - If an item fails validation, attempts to salvage with defaults (quantity=1, unit="serving").
  - Returns list of validated `FoodItem` objects.
- **`extract_and_validate(user_message: str) -> dict`:**
  - Calls `extract_food_items`.
  - Applies known foods lookup (see below) to override estimated macros.
  - Builds a human-readable confirmation string.
  - Returns `{ items: [...], confirmation: str, count: int }`.

---

### 4. Pydantic Validation Model

`FoodItem` model with these constraints:

| Field | Type | Constraints |
|---|---|---|
| name | str | min 1 char, max 200, must contain at least one letter |
| quantity | float | default 1, must be > 0 and ≤ 50 |
| unit | str | default "serving", max 50 chars |
| calories | Optional[float] | ≥ 0, ≤ 10000 |
| protein_g | Optional[float] | ≥ 0, ≤ 500 |
| carbs_g | Optional[float] | ≥ 0, ≤ 1000 |
| fat_g | Optional[float] | ≥ 0, ≤ 500 |
| estimated | bool | default True |

If `quantity` comes in as 0 or None, override to 1.

---

### 5. Known Foods Dictionary

A dictionary mapping lowercase food name patterns to exact macro data. This bypasses AI estimation for foods logged frequently.

```python
KNOWN_FOODS = {
    "nurri protein shake": {
        "name": "Nurri Protein Shake",
        "calories": 160,    # ← UPDATE WITH ACTUAL LABEL VALUES
        "protein_g": 30,
        "carbs_g": 5,
        "fat_g": 2,
        "unit": "shake",
        "estimated": False,
    },
    # Add more regulars here
}
```

Lookup function: `lookup_known_food(name: str) -> Optional[dict]` — does fuzzy substring matching (if the known key is contained in the food name or vice versa). When a match is found, override the AI's estimated macros with the known values and set `estimated = False`.

Apply this AFTER the AI extraction so the AI still handles quantity and unit parsing.

---

### 6. Retry Logic

If the first Haiku call fails (JSON parse error, empty result, exception):
1. Retry ONCE with a modified prompt: `"Log this food exactly as stated: {original_message}"`
2. If retry also fails, return a user-friendly error: `"Sorry, I couldn't parse that food entry. Try being more specific, like '1 protein shake' or '2 eggs with toast'."`

Do not retry more than once.

---

### 7. Integration Points

**In the existing message handler (wherever MCP messages arrive):**

```
1. Receive user message
2. Call detect_food_logging_intent(message)
3. If True → call nutrition_agent.extract_and_validate(message)
4.         → write each item to the food_logs table in PostgreSQL
5.         → return the confirmation string to the user
6. If False → pass to existing general handler
```

**Instantiation (at app startup):**
- Create one `NutritionAgent` instance, reuse across requests.
- Pass the existing `AsyncAnthropic` client.

---

## File Structure

Place the nutrition agent in its own module:

```
fitclaude/
├── ...existing files...
├── agents/
│   ├── __init__.py
│   └── nutrition_agent.py    ← all components above go here
```

Or if you prefer flat structure, `nutrition_agent.py` at the app root is fine.

---

## Testing Checklist

After implementation, test these inputs and verify correct output:

| Input | Expected quantity | Expected name |
|---|---|---|
| `1 nurri protein shake` | 1 | Nurri Protein Shake |
| `nurri protein shake` | 1 | Nurri Protein Shake |
| `protein shake` | 1 | Protein Shake |
| `2 eggs and toast` | 2 eggs, 1 toast | Eggs, Toast |
| `had a bagel` | 1 | Bagel |
| `3 scoops whey with water` | 3 whey, 1 water | Whey Protein, Water |
| `chicken rice bowl` | 1 | Chicken Rice Bowl |

**Failure cases to verify:**
- AI returns quantity 0 → should be corrected to 1
- AI returns a dict instead of array → should be wrapped
- AI adds markdown fences → should be stripped
- AI returns empty array → should trigger retry
- Garbage input like "asdfgh" → should return error message, not crash

---

## Future Enhancements (not in scope now)

- Food database API integration (e.g., Nutritionix, FatSecret) for accurate macros
- "Undo last log" command detection in the intent router
- Meal-level grouping (tag entries as breakfast/lunch/dinner)
- Image-based food logging (photo → macros) — already partially built
- User-specific known foods stored in DB instead of hardcoded dict
