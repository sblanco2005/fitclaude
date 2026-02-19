# Nutrition Tracking

## Overview
Users log meals through natural language or photos. The AI coach parses food into macros, logs them, and tracks daily progress toward calorie and protein targets.

## Logging Methods

### 1. Natural Language (via chat)
User says: "I had a chicken burrito, a side of chips, and a Diet Coke"
- Coach parses into individual items with estimated macros
- Uses "roughly" or "approximately" for estimates
- Confirms what was logged and shows daily totals
- Calls `log_nutrition` tool with: raw_text, calories, protein_g, carbs_g, fat_g, meal_type

### 2. Photo-Based (via chat + image upload)
User uploads a meal photo with "Log this lunch"
- Image sent to Claude vision API
- Coach identifies foods on the plate
- Asks clarifying questions about portions:
  - "That looks like grilled chicken and rice. About 6oz of chicken? A cup of rice?"
- User confirms or adjusts
- Coach logs with estimated macros

### 3. Quick Log (future — not in MVP)
- Tap to log common meals from history
- Barcode scanning

## Meal Types
- `breakfast`
- `lunch`
- `dinner`
- `snack`
- `pre_workout`
- `post_workout`

## Daily Dashboard
Shows progress toward user's targets:

```
Calories:  1,850 / 2,400 kcal  [=========>       ] 77%
Protein:   142g / 180g          [============>    ] 79%
Carbs:     220g                 (no target set)
Fat:       65g                  (no target set)
```

- Circular progress rings on mobile (calories = large ring, protein = secondary)
- Color coding: green when on track, yellow when behind, red when over

## Meal Timeline
Visual timeline of today's meals:
```
8:30 AM  — Breakfast: Oatmeal, banana, protein shake (450 cal, 35g P)
12:15 PM — Lunch: Chicken burrito, chips (780 cal, 42g P)
3:00 PM  — Snack: Greek yogurt, almonds (280 cal, 18g P)
6:30 PM  — Dinner: [not logged yet]
```

## Nutrition Data Model
```
NutritionLog
  ├── id, userId, date, mealType
  ├── rawInput (original text or "Photo: [description]")
  ├── parsedItems (JSON of individual food items, optional)
  ├── calories, proteinG, carbsG, fatG, fiberG
  ├── imageUrl (if logged via photo)
  └── createdAt
```

## History View
- Past 7 days of nutrition logs (configurable)
- Daily summary: total calories, protein, carbs, fat
- Expandable to see individual meals
- Trend line showing daily calorie intake over time

## API Endpoints
- `GET /api/nutrition/today` — aggregated daily totals
- `GET /api/nutrition/history?daysBack=7` — past nutrition logs
- Nutrition logging happens through chat (POST /api/chat → log_nutrition tool)

## Mobile UX
- Nutrition page opens to today's dashboard by default
- Large, easy-to-read macro numbers
- Circular progress rings for visual feedback
- Meal entries are compact cards in a vertical list
- Tap a meal to see breakdown details
- Quick access to camera for photo logging
