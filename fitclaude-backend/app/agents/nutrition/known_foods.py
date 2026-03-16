"""Known foods dictionary — bypasses AI estimation for frequently logged foods."""

from typing import Optional

KNOWN_FOODS: dict[str, dict] = {
    "nurri protein shake": {
        "name": "Nurri Protein Shake",
        "calories": 160,
        "protein_g": 30,
        "carbs_g": 5,
        "fat_g": 2,
        "unit": "shake",
        "estimated": False,
    },
    # Add more regulars here as the user logs them frequently
}


def lookup_known_food(name: str) -> Optional[dict]:
    """Fuzzy substring match against known foods."""
    lower = name.lower().strip()
    for key, data in KNOWN_FOODS.items():
        if key in lower or lower in key:
            return data
    return None
