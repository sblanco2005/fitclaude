"""Vision-based Nutrition Agent.

Analyzes food photos using Claude Sonnet's vision capabilities
to identify food items and estimate macros. Pro/Unlimited only.
"""

import json
import logging
import re

from anthropic import AsyncAnthropic

from app.agents.base import BaseAgent
from app.agents.nutrition.known_foods import lookup_known_food
from app.agents.nutrition.schemas import FoodItem
from app.agents.nutrition.vision_prompts import VISION_NUTRITION_PROMPT

logger = logging.getLogger(__name__)


class VisionNutritionAgent(BaseAgent):
    def __init__(self, client: AsyncAnthropic, model: str = "claude-sonnet-4-20250514"):
        super().__init__(client, model)

    async def handle(self, user_message: str, **kwargs) -> dict:
        """Main entry point."""
        image_base64 = kwargs.get("image_base64")
        image_media_type = kwargs.get("image_media_type")
        if not image_base64 or not image_media_type:
            return {"error": "No image provided for vision analysis."}
        return await self.extract_and_validate(image_base64, image_media_type, user_text=user_message)

    async def extract_food_items_from_image(
        self,
        image_base64: str,
        image_media_type: str,
        user_text: str = "",
    ) -> tuple[list[FoodItem], dict | None]:
        """
        Call Sonnet with the food photo to extract food items.
        Returns (items, usage) where usage is the API response usage object.
        """
        # Build multimodal message
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type,
                    "data": image_base64,
                },
            },
        ]
        if user_text:
            content.append({"type": "text", "text": user_text})

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=VISION_NUTRITION_PROMPT,
                messages=[{"role": "user", "content": content}],
            )
        except Exception as e:
            logger.error(f"[VisionNutritionAgent] API call failed: {e}")
            raise

        usage = response.usage

        raw = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )

        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw.strip())

        # Parse JSON
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"[VisionNutritionAgent] JSON parse failed, raw: {raw[:300]}")
            raise ValueError("Failed to parse food items from vision response")

        # Wrap dict in list if needed
        if isinstance(data, dict):
            data = [data]

        if not isinstance(data, list) or len(data) == 0:
            raise ValueError("Vision agent returned empty or invalid food list")

        # Validate each item
        items: list[FoodItem] = []
        for entry in data:
            try:
                items.append(FoodItem(**entry))
            except Exception as e:
                logger.warning(f"[VisionNutritionAgent] Validation failed for {entry}: {e}")
                try:
                    entry.setdefault("quantity", 1)
                    entry.setdefault("unit", "serving")
                    items.append(FoodItem(**entry))
                except Exception:
                    logger.warning(f"[VisionNutritionAgent] Could not salvage entry: {entry}")

        return items, usage

    async def extract_and_validate(
        self,
        image_base64: str,
        image_media_type: str,
        user_text: str = "",
    ) -> dict:
        """
        Extract food items from photo, apply known-foods overrides, build confirmation.
        Returns same dict shape as text NutritionAgent plus _usage for token tracking.
        """
        usage = None
        try:
            items, usage = await self.extract_food_items_from_image(
                image_base64, image_media_type, user_text
            )
        except (ValueError, Exception) as e:
            # Retry once with simplified text instruction
            logger.warning(f"[VisionNutritionAgent] First attempt failed ({e}), retrying")
            try:
                items, usage = await self.extract_food_items_from_image(
                    image_base64, image_media_type,
                    user_text="Identify each food in this photo and estimate macros."
                )
            except Exception:
                return {
                    "error": "Sorry, I couldn't identify the food in this photo. "
                             "Try a clearer photo or describe what you ate in text."
                }

        if not items:
            return {
                "error": "Sorry, I couldn't identify any food in this photo. "
                         "Try a clearer photo or describe what you ate in text."
            }

        # Apply known-foods overrides
        for item in items:
            known = lookup_known_food(item.name)
            if known:
                item.name = known.get("name", item.name)
                item.calories = known.get("calories", item.calories)
                item.protein_g = known.get("protein_g", item.protein_g)
                item.carbs_g = known.get("carbs_g", item.carbs_g)
                item.fat_g = known.get("fat_g", item.fat_g)
                item.unit = known.get("unit", item.unit)
                item.estimated = known.get("estimated", False)

        # Build confirmation and totals
        parts = []
        total_cal = 0.0
        total_pro = 0.0
        total_carb = 0.0
        total_fat = 0.0

        for item in items:
            if item.unit and item.unit.endswith("g") and item.unit[:-1].isdigit():
                parts.append(f"{item.name} ({item.unit})")
            else:
                qty_str = f"{int(item.quantity)}x" if item.quantity == int(item.quantity) else f"{item.quantity}x"
                parts.append(f"{qty_str} {item.name}")
            # Macros are already total (prompt instructs this)
            total_cal += (item.calories or 0)
            total_pro += (item.protein_g or 0)
            total_carb += (item.carbs_g or 0)
            total_fat += (item.fat_g or 0)

        # Build raw_text from identified items (for the nutrition log)
        raw_text = user_text if user_text else f"Food photo: {', '.join(parts)}"

        result = {
            "items": [item.model_dump() for item in items],
            "confirmation": ", ".join(parts),
            "count": len(items),
            "raw_text": raw_text,
            "total_calories": round(total_cal),
            "total_protein_g": round(total_pro, 1),
            "total_carbs_g": round(total_carb, 1),
            "total_fat_g": round(total_fat, 1),
        }

        # Include usage for token tracking (coach.py will pop this before returning to user)
        if usage:
            result["_usage"] = usage

        return result
