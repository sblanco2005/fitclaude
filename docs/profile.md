# User Profile & Settings

## Overview
The user profile stores personal info, fitness goals, gym setup, and nutrition targets. This data is injected into the AI coach's context on every chat message so it can give personalized recommendations.

## Profile Fields

### Identity
- **name** — display name
- **email** — from Google OAuth (auto-populated)
- **image** — profile photo from Google (auto-populated)

### Body Metrics
- **age** — years (optional)
- **weightKg** — current body weight in kg (optional)
- **heightCm** — height in cm (optional)

### Fitness Profile
- **fitnessGoal** — one of:
  - `build_muscle` — hypertrophy focus, caloric surplus
  - `lose_fat` — deficit-oriented, higher protein
  - `maintain` — maintenance calories, balanced training
  - `endurance` — cardio emphasis, moderate resistance
  - `flexibility` — mobility work, active recovery
- **experienceLevel** — one of:
  - `beginner` — <6 months consistent training
  - `intermediate` — 6 months to 2 years
  - `advanced` — 2+ years, knows their way around
- **injuriesNotes** — free text for current injuries or limitations
  - Example: "Bad left shoulder, no overhead pressing"
  - Coach reads this before every workout suggestion

### Gym Setup
- **gymType** — determines equipment handling:
  - `own_gym` — user has home/garage gym. Must list equipment.
  - `public_gym` — user goes to a commercial gym. Full equipment assumed.
- **equipmentText** — free-text list of available equipment (own_gym only)
  - Format: one item per line or comma-separated
  - Example:
    ```
    Barbell + plates (up to 300lb)
    Dumbbells 5-50lb
    Pull-up bar
    Adjustable bench
    Squat rack
    Resistance bands
    ```

### Nutrition Targets
- **dailyCalorieTarget** — kcal per day (e.g. 2400)
- **dailyProteinTarget** — grams per day (e.g. 180)

## How Profile Data Is Used

### In Chat (System Prompt Injection)
Every chat message includes a `USER CONTEXT` block:
```
USER CONTEXT:
- Name: Santiago
- Goal: build_muscle
- Experience: intermediate
- Gym type: own_gym
- Equipment available: Barbell + plates, Dumbbells 5-50lb, Pull-up bar, Bench, Squat rack
- Weight: 82 kg
- Daily calorie target: 2400 kcal
- Daily protein target: 180g
```

### Equipment Logic
- `public_gym` → context says "Full commercial gym" → coach assumes all standard equipment
- `own_gym` + equipment listed → coach only suggests exercises doable with listed gear
- `own_gym` + no equipment → coach asks "What equipment do you have?" on first interaction

### Injury Awareness
- If `injuriesNotes` is set, coach reads it before every workout
- Coach avoids aggravating movements
- Coach asks clarifying questions ("Does it hurt with any pressing, or just overhead?")

## Settings Page

### Layout (mobile-first)
Vertical sections, each in a card:

1. **Profile Card**
   - Name (editable)
   - Fitness goal (dropdown)
   - Experience level (dropdown)
   - Age, weight, height (optional number inputs)

2. **Gym & Equipment Card**
   - Gym type toggle: Home Gym / Public Gym
   - Equipment text area (visible only for Home Gym)
   - Placeholder text guides format

3. **Nutrition Targets Card**
   - Daily calorie target (number input)
   - Daily protein target (number input)
   - Helper text: "Your coach uses these to track your nutrition progress"

4. **Injuries & Notes Card**
   - Large text area
   - Placeholder: "Any injuries, limitations, or things your coach should know?"

5. **Save Button**
   - Single save for all sections
   - PATCH /api/profile with changed fields only

## API
- `GET /api/profile` — returns authenticated user's fitness profile
- `PATCH /api/profile` — updates profile fields (partial update, only changed fields)

## Data Model
All profile fields live on the `User` table (no separate profile table). The User model extends NextAuth's base User with fitness-specific fields.
