"""Vision via the Meta Model API (Muse Spark).

Muse Spark is natively multimodal, so unlike the Claude-CLI path we send the
image straight to the Messages API as an image block — no VPS/CLI dependency.
Mirrors vision_cli's interface (extract_nutrition_from_image) and return shape
so it's a drop-in when USE_META is on. The coach handles general/board photos
natively by passing the image into its own tool-use loop, so this module only
needs the dedicated nutrition extractor.
"""

from __future__ import annotations

import json
import logging
import re

from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)

# Own Bearer-auth client (auth_token, not x-api-key) so we don't import the
# coach module (avoids a circular import).
_client = AsyncAnthropic(auth_token=settings.model_api_key, base_url=settings.meta_base_url)


def _extract_json(text: str | None) -> dict | None:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


async def _vision_text(image_base64: str, media_type: str | None, prompt: str, max_tokens: int = 2048) -> str | None:
    """Send an image + prompt to Muse Spark and return the final text (thinking blocks skipped)."""
    try:
        resp = await _client.messages.create(
            model=settings.meta_model,
            max_tokens=max_tokens,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image", "source": {"type": "base64", "media_type": media_type or "image/jpeg", "data": image_base64}},
                ],
            }],
        )
        return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text" and getattr(b, "text", None))
    except Exception as e:
        logger.error(f"[vision-meta] request failed: {e}")
        return None


async def extract_nutrition_from_image(
    image_base64: str, media_type: str | None, user_text: str = "", weight_unit: str = "kg"
) -> dict:
    """Return {raw_text, total_calories, total_protein_g, total_carbs_g, total_fat_g, confirmation} or {error}."""
    unit = "ounces" if weight_unit == "lb" else "grams"
    prompt = (
        f'The user attached a photo of food. User note: "{user_text or ""}". '
        "Identify each food item and its portion and estimate the nutrition "
        f"(portions in {unit}). Respond with ONLY a JSON object — no prose, no code fences — with keys: "
        "raw_text (a short human description of the meal), total_calories (integer), total_protein_g (integer), "
        "total_carbs_g (integer), total_fat_g (integer), confirmation (a short phrase like 'grilled chicken and rice'). "
        'If there is no food in the image, respond with {"error":"no food detected in the photo"}.'
    )
    text = await _vision_text(image_base64, media_type, prompt)
    if text is None:
        return {"error": "Vision analysis failed — please try again."}
    data = _extract_json(text)
    if not data:
        return {"error": "Couldn't read the photo. Try a clearer picture or type it in."}
    if "error" in data:
        return {"error": str(data["error"])}
    try:
        return {
            "raw_text": str(data.get("raw_text") or data.get("confirmation") or "meal"),
            "total_calories": int(round(float(data.get("total_calories", 0) or 0))),
            "total_protein_g": int(round(float(data.get("total_protein_g", 0) or 0))),
            "total_carbs_g": int(round(float(data.get("total_carbs_g", 0) or 0))),
            "total_fat_g": int(round(float(data.get("total_fat_g", 0) or 0))),
            "confirmation": str(data.get("confirmation") or data.get("raw_text") or "meal"),
        }
    except Exception as e:
        logger.error(f"[vision-meta] nutrition coerce failed: {e}; data={data}")
        return {"error": "Couldn't parse the nutrition from the photo."}
