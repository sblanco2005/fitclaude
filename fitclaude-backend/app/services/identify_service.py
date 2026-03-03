"""Identify gym equipment from a photo using Claude Haiku vision."""

import json
import re

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.exercise_service import get_all_exercises

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

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

    # 1. Claude Haiku vision call
    response = await client.messages.create(
        model=settings.haiku_model,
        max_tokens=300,
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

    text = response.content[0].text

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
