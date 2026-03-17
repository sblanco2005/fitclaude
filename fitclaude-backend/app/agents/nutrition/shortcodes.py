"""Shortcode generation and resolution for user food dictionary."""

import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_food import UserFood

# Generic food words — skip these to find the brand/distinctive word
_GENERIC_FOOD_WORDS = {
    "chicken", "beef", "pork", "steak", "fish", "salmon", "tuna", "shrimp",
    "turkey", "lamb", "meat", "breast", "thigh", "wing", "drumstick",
    "protein", "shake", "bar", "stick", "strip", "jerky",
    "rice", "pasta", "bread", "oatmeal", "cereal", "bagel", "wrap",
    "salad", "soup", "bowl", "plate", "cup", "scoop",
    "egg", "eggs", "yogurt", "milk", "cheese", "butter",
    "banana", "apple", "orange", "berries", "avocado",
    "ground", "chopped", "grilled", "baked", "fried", "roasted", "boiled",
    "small", "medium", "large", "whole", "half",
}


def generate_shortcode(food_name: str) -> str:
    """Generate a shortcode candidate from a food name.

    Takes words before the first generic food word and joins them.
    Falls back to the first word if all words are generic.

    Examples:
        "Field Trip Chicken Stick" → "fieldtrip"
        "Nurri Protein Shake"     → "nurri"
        "Chicken Breast"          → "chicken"
        "Oikos Greek Yogurt"      → "oikos"
        "Eggs"                    → "eggs"
    """
    # Lowercase, keep only alpha + spaces
    cleaned = re.sub(r"[^a-z\s]", "", food_name.lower()).strip()
    words = cleaned.split()
    if not words:
        return "food"

    # Collect brand/distinctive words (before first generic word)
    brand_words = []
    for w in words:
        if w in _GENERIC_FOOD_WORDS:
            break
        brand_words.append(w)

    if brand_words:
        return "".join(brand_words)

    # All words are generic — use the first one
    return words[0]


async def resolve_shortcode(
    db: AsyncSession, user_id: str, food_name: str
) -> str:
    """Generate a unique shortcode for a user's food.

    Checks for conflicts and appends a number if needed.
    """
    candidate = generate_shortcode(food_name)

    # Check if this exact food already has a shortcode
    result = await db.execute(
        select(UserFood.shortcode).where(
            UserFood.user_id == user_id,
            func.lower(UserFood.name) == food_name.lower(),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Check if the candidate is taken by another food
    for suffix in ["", "2", "3", "4", "5", "6", "7", "8", "9"]:
        test = candidate + suffix
        result = await db.execute(
            select(UserFood.id).where(
                UserFood.user_id == user_id,
                func.lower(UserFood.shortcode) == test,
            )
        )
        if result.scalar_one_or_none() is None:
            return test

    # Extremely unlikely: all 9 variants taken, use full name hash
    import hashlib
    h = hashlib.md5(food_name.lower().encode()).hexdigest()[:6]
    return f"{candidate}{h}"
