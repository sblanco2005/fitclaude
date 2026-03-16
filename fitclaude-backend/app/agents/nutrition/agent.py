"""Dedicated Nutrition Logging Agent.

Handles food-logging messages with a specialized extraction prompt,
Pydantic validation, known-foods override, and retry logic.
"""

import json
import logging
import re

from anthropic import AsyncAnthropic

from app.agents.base import BaseAgent
from app.agents.nutrition.known_foods import lookup_known_food
from app.agents.nutrition.prompts import NUTRITION_SYSTEM_PROMPT
from app.agents.nutrition.schemas import FoodItem

logger = logging.getLogger(__name__)


class NutritionAgent(BaseAgent):
    def __init__(self, client: AsyncAnthropic, model: str = "claude-haiku-4-5-20251001"):
        super().__init__(client, model)

    async def handle(self, user_message: str, **kwargs) -> dict:
        """Main entry point — extract, validate, and return result."""
        return await self.extract_and_validate(user_message)

    async def extract_food_items(self, user_message: str) -> list[FoodItem]:
        """Call Haiku with the nutrition prompt to extract food items."""
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=NUTRITION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
        except Exception as e:
            logger.error(f"[NutritionAgent] API call failed: {e}")
            raise

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
            logger.warning(f"[NutritionAgent] JSON parse failed, raw: {raw[:200]}")
            raise ValueError("Failed to parse food items from AI response")

        # Wrap dict in list if needed
        if isinstance(data, dict):
            data = [data]

        if not isinstance(data, list) or len(data) == 0:
            raise ValueError("AI returned empty or invalid food list")

        # Validate each item
        items: list[FoodItem] = []
        for entry in data:
            try:
                items.append(FoodItem(**entry))
            except Exception as e:
                logger.warning(f"[NutritionAgent] Validation failed for {entry}: {e}")
                # Try to salvage with defaults
                try:
                    entry.setdefault("quantity", 1)
                    entry.setdefault("unit", "serving")
                    items.append(FoodItem(**entry))
                except Exception:
                    logger.warning(f"[NutritionAgent] Could not salvage entry: {entry}")

        return items

    async def extract_and_validate(self, user_message: str) -> dict:
        """
        Extract food items, apply known-foods overrides, build confirmation.
        Returns {items, confirmation, count, raw_text, total_calories, total_protein_g, total_carbs_g, total_fat_g}
        """
        try:
            items = await self.extract_food_items(user_message)
        except (ValueError, Exception) as e:
            # Retry once with simplified prompt
            logger.warning(f"[NutritionAgent] First attempt failed ({e}), retrying")
            try:
                items = await self.extract_food_items(
                    f"Log this food exactly as stated: {user_message}"
                )
            except Exception:
                return {
                    "error": "Sorry, I couldn't parse that food entry. "
                             "Try being more specific, like '1 protein shake' or '2 eggs with toast'."
                }

        if not items:
            return {
                "error": "Sorry, I couldn't parse that food entry. "
                         "Try being more specific, like '1 protein shake' or '2 eggs with toast'."
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
            qty_str = f"{int(item.quantity)}x" if item.quantity == int(item.quantity) else f"{item.quantity}x"
            parts.append(f"{qty_str} {item.name}")
            total_cal += (item.calories or 0) * item.quantity
            total_pro += (item.protein_g or 0) * item.quantity
            total_carb += (item.carbs_g or 0) * item.quantity
            total_fat += (item.fat_g or 0) * item.quantity

        return {
            "items": [item.model_dump() for item in items],
            "confirmation": ", ".join(parts),
            "count": len(items),
            "raw_text": user_message,
            "total_calories": round(total_cal),
            "total_protein_g": round(total_pro, 1),
            "total_carbs_g": round(total_carb, 1),
            "total_fat_g": round(total_fat, 1),
        }
