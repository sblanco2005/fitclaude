# Vision Nutrition Agent — Implementation Spec

## Overview

A dedicated vision-capable nutrition agent that analyzes food photos using Claude Sonnet to identify food items and estimate macros. Gated to Pro/Unlimited tiers only.

## How It Works

```
User attaches food photo in Nutrition chat topic
        ↓
Frontend shows confirmation popup:
  - Pro/Unlimited: "Analyze food photo? Uses Pro credits." → [Analyze Food] / [Send normally]
  - Free: "Available on Pro/Unlimited plans." → [Send normally]
        ↓ (user clicks "Analyze Food")
POST /api/chat with use_vision=true
        ↓
Coach handle_chat() → vision fast path
  1. Tier gate: reject free users
  2. Rate limit check
  3. Call VisionNutritionAgent.extract_and_validate(image, text)
  4. Log nutrition via _tool_log_nutrition
  5. Log token usage (endpoint="vision_nutrition")
  6. Return itemized confirmation
```

## Components

### VisionNutritionAgent (`vision_agent.py`)
- Extends `BaseAgent`
- Model: Claude Sonnet (vision-capable)
- `extract_food_items_from_image(base64, media_type, user_text)` → calls Sonnet with multimodal message
- `extract_and_validate(base64, media_type, user_text)` → extract, validate, apply known_foods, return totals
- Returns `_usage` key for token tracking
- Retry once on failure with simplified prompt
- Reuses `FoodItem` schema and `lookup_known_food` from text agent

### Vision Prompt (`vision_prompts.py`)
- JSON-only output (same schema as text nutrition prompt)
- Rules: identify each food separately, estimate portions from visual cues, macros are total amounts
- Handles branded/restaurant foods, sauces, beverages
- 3 few-shot examples

### Tier Gate
- Backend enforces: `user.tier == "free"` → reject with upgrade message
- Frontend shows appropriate popup based on `profile.tier`
- Free users can still send images normally (goes through coach path for nutrition labels)

### Token Tracking
- Logged with `endpoint="vision_nutrition"` in TokenUsage table
- Uses Sonnet pricing ($3/M input, $15/M output)
- Separate from regular chat usage

## Files

| File | Change |
|------|--------|
| `agents/nutrition/vision_agent.py` | New — VisionNutritionAgent class |
| `agents/nutrition/vision_prompts.py` | New — VISION_NUTRITION_PROMPT |
| `agents/__init__.py` | Register vision_nutrition_agent |
| `schemas/chat.py` | Add `use_vision: bool = False` |
| `agents/coach.py` | Vision fast path before nutrition fast path |
| `routers/chat.py` | Pass use_vision to handle_chat |
| `app/api/profile/route.ts` | Expose tier in profile |
| `app/api/chat/route.ts` | Forward use_vision to backend |
| `context/FitClaudeContext.tsx` | Add useVision param to sendMessage, tier to profile |
| `types/index.ts` | Add tier to UserProfile |
| `app/chat/page.tsx` | Vision confirmation popup |

## Cost Per Vision Call

- System prompt: ~800 tokens
- Image: ~1,000-3,000 tokens (depends on resolution)
- Response: ~100-300 tokens
- **Total: ~2,000-4,000 tokens per call**
- **Cost: ~$0.006-0.012 per call** (Sonnet pricing)
- ~10x more expensive than text nutrition agent (~$0.0002/call with Haiku)
