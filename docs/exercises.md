# Exercise Library

## Overview
FitClaude ships with 35 seeded exercises across 11 muscle groups, each with 3 "spicy" variations (105 total). The library can be expanded via YouTube video import.

## Seeded Exercises

### Muscle Groups (exercise count)
- Chest (4): Bench Press, Incline Dumbbell Press, Dumbbell Flyes, Push-ups
- Back (5): Barbell Row, Pull-ups, Dumbbell Row, Lat Pulldown, Cable Row
- Shoulders (3): Overhead Press, Lateral Raise, Face Pull
- Biceps (2): Barbell Curl, Hammer Curl
- Triceps (2): Tricep Dip, Skull Crusher
- Quadriceps (3): Barbell Back Squat, Front Squat, Leg Press
- Hamstrings (3): Romanian Deadlift, Leg Curl, Nordic Curl
- Glutes (3): Hip Thrust, Bulgarian Split Squat, Glute Bridge
- Core (3): Plank, Ab Rollout, Hanging Leg Raise
- Calves (2): Standing Calf Raise, Seated Calf Raise
- Full Body (5): Deadlift, Clean and Press, Kettlebell Swing, Burpee, Turkish Get-up

### Exercise Fields
- **name** — unique identifier (e.g. "Barbell Back Squat")
- **muscleGroup** — primary target (e.g. "quadriceps")
- **secondaryMuscles** — secondary targets (e.g. "glutes, hamstrings, core")
- **equipmentRequired** — needed equipment (e.g. "barbell, squat rack")
- **difficulty** — beginner, intermediate, advanced
- **exerciseType** — compound, isolation, cardio, stretch, plyometric
- **instructions** — form cues and execution details

## Spicy Variation System

The signature FitClaude feature. Each exercise can have variations at 3 spicy levels.

### Spicy Levels
- **Level 1** — Mild: Small tweak to standard form (tempo change, slight grip adjustment)
- **Level 2** — Medium: Notable modification that changes the stimulus (1.5 reps, unilateral)
- **Level 3** — Hot: Advanced technique for experienced lifters (cluster sets, mechanical drop sets)

### Modification Types (5 categories)

| Type | Level 1 | Level 2 | Level 3 |
|------|---------|---------|---------|
| **Tempo** | Slow eccentric (3s down) | 3-1-3 tempo | 5s eccentric + 2s pause |
| **Grip** | Wide grip | Close grip | Mixed/false grip |
| **Stance** | Staggered stance | Single leg/unilateral | Deficit/elevated |
| **Load Curve** | Pause at midpoint | 1.5 reps (full + half) | Mechanical drop set |
| **Intensity** | Last set to failure | Drop set on final | Cluster sets (rest-pause) |

### How It Works
1. Coach decides user needs a variation (boredom, plateau, user request)
2. Calls `get_spicy_variation` tool with exercise name + desired level
3. System checks DB for pre-defined variations first
4. Falls back to rule-based generation from modification types above
5. Coach presents the variation with description and form cues

### Variation Data Model
```
ExerciseVariation
  ├── id, baseExerciseId
  ├── name (e.g. "Tempo Barbell Back Squat (3-1-3)")
  ├── spicyLevel (1-3)
  ├── modificationType (tempo, grip, stance, load_curve, intensity)
  ├── description (detailed execution instructions)
  └── additionalEquipment (if variation needs extra gear)
```

## YouTube Import

Users can expand the exercise library by sharing YouTube fitness video links.

### Flow
1. User shares link in chat: "Add exercises from this video: https://youtube.com/watch?v=..."
2. Coach calls `parse_youtube_video` tool
3. System extracts video ID from URL
4. Fetches transcript via `youtube-transcript-api`
5. Sends transcript to Claude with focused extraction prompt
6. Claude returns structured exercise data (name, muscle group, equipment, instructions)
7. System deduplicates against existing exercises (by name, case-insensitive)
8. Inserts new exercises + generates variations
9. Coach reports: "Added 5 new exercises, skipped 2 duplicates"

### Supported URL Formats
- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/shorts/VIDEO_ID`

## Exercise Library Page

### Layout
- Search bar at top
- Filter chips: muscle group, difficulty, exercise type
- Grid of exercise cards (2 columns on mobile, 3-4 on desktop)

### Exercise Card
- Exercise name (bold)
- Muscle group badge (color-coded by group)
- Difficulty badge (beginner=green, intermediate=yellow, advanced=red)
- Equipment required (small text)
- Tap to expand → shows:
  - Full instructions
  - Spicy variations at each level
  - Equipment details

### Mobile UX
- Cards are full-width on small screens
- Search is sticky at top
- Filter chips scroll horizontally
- Tap card to see full details in a bottom sheet or expanded view
