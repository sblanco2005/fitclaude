"""Identify gym equipment from a photo.

Vision runs on Meta (Muse Spark) when USE_META is on — it's natively multimodal
and needs no Anthropic credits. Falls back to the Anthropic Haiku vision model
otherwise.
"""

import json
import re

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.exercise_service import get_all_exercises

_META_ENABLED = bool(settings.use_meta and settings.model_api_key)
if _META_ENABLED:
    # Bearer auth (auth_token), not x-api-key.
    client = AsyncAnthropic(auth_token=settings.model_api_key, base_url=settings.meta_base_url)
    _IDENTIFY_MODEL = settings.meta_model
    # Reasoning model — thinking tokens count against max_tokens, so give it room.
    _IDENTIFY_MAX_TOKENS = 1500
else:
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    _IDENTIFY_MODEL = settings.haiku_model
    _IDENTIFY_MAX_TOKENS = 400

IDENTIFY_PROMPT = """You are a gym equipment identification expert. Analyze this photo and identify the gym machine or exercise setup.

Return ONLY a JSON object with these fields:
{
  "equipment_name": "The common name for this machine/equipment (e.g., 'Lat Pulldown Machine', 'Cable Crossover', 'Leg Press')",
  "primary_exercise": "The most common exercise done on this machine (e.g., 'Lat Pulldown', 'Cable Fly', 'Leg Press')",
  "muscle_group": "The primary muscle group worked (one of: chest, back, legs, shoulders, arms, biceps, triceps, core, glutes, hamstrings, quadriceps, calves)",
  "alternative_exercises": ["Other exercises that can be done on this machine", "Up to 3 alternatives"],
  "confidence": "high/medium/low"
}

Rules:
- If the image is unclear, blurry, or not showing gym equipment, set confidence to "low" and give your best guess.
- If you cannot identify any gym equipment at all, return: {"equipment_name": "unknown", "primary_exercise": "unknown", "muscle_group": "unknown", "alternative_exercises": [], "confidence": "none"}
- Use common exercise names that a gym-goer would recognize.
- Return ONLY the JSON, no other text."""


async def identify_exercise(
    image_base64: str,
    image_media_type: str,
    db: AsyncSession,
) -> dict:
    """Send image to Claude Haiku, then fuzzy-match results against exercise DB."""

    # 1. Vision call (Meta Muse Spark, or Anthropic Haiku fallback)
    response = await client.messages.create(
        model=_IDENTIFY_MODEL,
        max_tokens=_IDENTIFY_MAX_TOKENS,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image_media_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": IDENTIFY_PROMPT},
                ],
            }
        ],
    )

    # Reasoning models (Meta) emit redacted_thinking blocks before the text —
    # concatenate only the text blocks (content[0] may not be text).
    text = "".join(
        b.text for b in response.content if getattr(b, "type", None) == "text" and getattr(b, "text", None)
    )

    # 2. Parse JSON from response (handle potential markdown code blocks)
    identification = _parse_json(text)
    if not identification or identification.get("confidence") == "none":
        return {
            "matches": [],
            "raw_identification": identification.get("equipment_name", "unknown") if identification else "unknown",
            "error": "Could not identify gym equipment in this image.",
        }

    # 3. Fuzzy-match against DB
    all_exercises = await get_all_exercises(db)
    matches = _fuzzy_match(all_exercises, identification)

    return {
        "matches": matches,
        "raw_identification": identification.get("equipment_name", "unknown"),
        "primary_exercise": identification.get("primary_exercise"),
        "muscle_group": identification.get("muscle_group"),
        "error": None,
    }


def _parse_json(text: str) -> dict | None:
    """Extract JSON from Claude's response, handling markdown code blocks."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding bare JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


def _fuzzy_match(all_exercises: list, identification: dict) -> list[dict]:
    """Match Claude's identification against DB exercises."""
    candidate_names = [identification.get("primary_exercise", "")]
    candidate_names.extend(identification.get("alternative_exercises", []))
    candidate_names = [n for n in candidate_names if n and n != "unknown"]

    target_muscle = (identification.get("muscle_group") or "").lower()

    matches: list[dict] = []
    seen_ids: set[str] = set()

    # Pass 1: exact and substring matches from candidate names
    for candidate in candidate_names:
        candidate_lower = candidate.lower()
        for ex in all_exercises:
            if ex.id in seen_ids:
                continue
            ex_lower = ex.name.lower()

            if candidate_lower == ex_lower:
                matches.append({"id": ex.id, "name": ex.name, "muscleGroup": ex.muscle_group, "confidence": "high"})
                seen_ids.add(ex.id)
            elif candidate_lower in ex_lower or ex_lower in candidate_lower:
                matches.append({"id": ex.id, "name": ex.name, "muscleGroup": ex.muscle_group, "confidence": "medium"})
                seen_ids.add(ex.id)

    # Pass 2: same muscle group (fill up to 5)
    if len(matches) < 5 and target_muscle and target_muscle != "unknown":
        for ex in all_exercises:
            if ex.id in seen_ids:
                continue
            if ex.muscle_group.lower() == target_muscle:
                matches.append({"id": ex.id, "name": ex.name, "muscleGroup": ex.muscle_group, "confidence": "low"})
                seen_ids.add(ex.id)
                if len(matches) >= 5:
                    break

    return matches[:5]
