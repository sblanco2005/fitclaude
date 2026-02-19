# AI Coach Chat

## Overview
The chat interface is the primary interaction point in FitClaude. Users talk to **Coach Fit**, an AI fitness coach powered by Claude, to generate workouts, log nutrition, get exercise variations, and more.

## Persona — Coach Fit
- Encouraging but not cheesy. Experienced gym buddy, not Instagram influencer.
- Casual, direct language. Short sentences for instructions.
- Celebrates PRs and consistency. Calls out sandbagging.
- Takes injuries and fatigue seriously — adjusts immediately.
- Suggests "spicy" exercise variations when users are in a rut.

## Capabilities (via tool-use)
The coach has 7 tools it can call during conversation:

| Tool | Trigger | What it does |
|------|---------|-------------|
| `generate_workout` | "Build me a push day" | Creates workout record, presents exercises |
| `log_nutrition` | "I had a chicken burrito and a coke" | Parses food into macros, logs to DB |
| `get_workout_history` | "What did I do last week?" | Fetches recent workouts for context |
| `get_daily_nutrition` | "How are my macros today?" | Returns daily totals |
| `get_spicy_variation` | "Give me something different for bench press" | Returns creative exercise variation |
| `mark_workout_complete` | "Done! That was a 7/10" | Marks workout complete with fatigue |
| `parse_youtube_video` | "Add exercises from this video: [URL]" | Extracts exercises from transcript |

## Tool-Use Flow
1. User sends message
2. Coach analyzes intent + calls appropriate tool(s)
3. Tool executes (DB write, data fetch, etc.)
4. Coach receives tool result
5. Coach formats response for the user
6. Loop repeats if more tools needed, otherwise returns text

## Vision / Photo Support
- User can upload a meal photo alongside their message
- Photo is sent as base64 to Claude's vision API
- Coach identifies food in the image
- Coach asks clarifying questions: "That looks like rice and grilled chicken. About a cup of rice? Full breast?"
- User confirms → coach logs macros via `log_nutrition` tool

## Message Types
- **Text** — standard chat messages (user and assistant)
- **Image + Text** — meal photo with context ("Log this lunch")
- **Workout Card** — structured workout display (rendered as a card, not raw text)
- **Nutrition Summary** — macro totals displayed as a compact card

## Conversation Rules
1. Always check user's equipment before suggesting exercises
2. Reference recent history for progressive overload
3. For nutrition, use "roughly" or "approximately" when estimating
4. Ask clarifying questions for injuries before modifying workouts
5. Keep workouts to 4-7 exercises unless requested otherwise
6. If high fatigue ratings (7+) in recent workouts, suggest deload
7. If own_gym user has no equipment listed, ask what they have
8. Public gym users → assume full commercial gym equipment

## Mobile UX
- Full-screen chat layout (messages fill viewport)
- Sticky input bar at bottom with text field + send button
- Camera/photo button to left of input for meal photos
- Auto-scroll to newest message
- Workout and nutrition cards render inline in the chat
- Messages have subtle entrance animation

## Conversation History
- Last 20 messages loaded into context per session
- Stored in `ConversationHistory` table (role, content, timestamp)
- User context (profile, equipment, goals) injected into system prompt every call

## API Flow
```
Frontend (Next.js)
  → POST /api/chat { message, image_base64?, image_media_type? }
  → Next.js API route (auth check, attach userId)
  → Proxy to Python backend POST /v1/chat
  → Python: Claude API call with tool-use loop
  → Returns { response, workout_id?, nutrition_log_id? }
  → Frontend displays response
```
