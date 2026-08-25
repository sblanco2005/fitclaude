"""Structured food-photo analysis for the Fuel review flow."""

from __future__ import annotations

from app.services.vision_cli import _extract_json, _run_claude_on_image


async def analyze_food_photo(
    image_base64: str,
    media_type: str | None,
    user_note: str = "",
    weight_unit: str = "lb",
) -> dict:
    unit = "ounces" if weight_unit == "lb" else "grams"
    prompt = (
        f'The user attached a food photo. User note: "{user_note or ""}". '
        "Read image file <IMAGE>. Identify every visible food or drink item and estimate its portion. "
        f"Use {unit} for portion estimates when practical. Account for likely cooking oil, dressing, sauces, cheese, "
        "and other calorie-dense additions when they are visible or strongly implied, but do not invent ingredients. "
        "Return ONLY valid JSON, no markdown, with this shape: "
        '{"description":"short meal description","items":[{"name":"food name","portion":"estimated portion",'
        '"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"confidence":"high|medium|low"}],'
        '"total_calories":0,"total_protein_g":0,"total_carbs_g":0,"total_fat_g":0,'
        '"uncertainty_percent":15,"uncertainty_reason":"short reason"}. '
        "uncertainty_percent should normally be 10-30 depending on portion/oil uncertainty. "
        'If no food is visible return {"error":"no food detected in the photo"}.'
    )

    text = await _run_claude_on_image(image_base64, media_type, prompt)
    if text is None:
        return {"error": "Vision analysis failed — please try again."}

    data = _extract_json(text)
    if not data:
        return {"error": "Couldn't read the photo. Try a clearer picture."}
    if data.get("error"):
        return {"error": str(data["error"])}

    raw_items = data.get("items") if isinstance(data.get("items"), list) else []
    items: list[dict] = []
    for raw in raw_items[:20]:
        if not isinstance(raw, dict) or not raw.get("name"):
            continue
        try:
            items.append(
                {
                    "name": str(raw.get("name") or "Food"),
                    "portion": str(raw.get("portion") or "1 serving"),
                    "calories": max(0, int(round(float(raw.get("calories") or 0)))),
                    "protein_g": max(0, int(round(float(raw.get("protein_g") or 0)))),
                    "carbs_g": max(0, int(round(float(raw.get("carbs_g") or 0)))),
                    "fat_g": max(0, int(round(float(raw.get("fat_g") or 0)))),
                    "confidence": str(raw.get("confidence") or "medium").lower(),
                }
            )
        except (TypeError, ValueError):
            continue

    if not items:
        return {"error": "Couldn't identify food portions from the photo."}

    total_calories = sum(item["calories"] for item in items)
    total_protein = sum(item["protein_g"] for item in items)
    total_carbs = sum(item["carbs_g"] for item in items)
    total_fat = sum(item["fat_g"] for item in items)

    try:
        uncertainty = int(round(float(data.get("uncertainty_percent") or 15)))
    except (TypeError, ValueError):
        uncertainty = 15
    uncertainty = min(40, max(5, uncertainty))

    return {
        "description": str(data.get("description") or ", ".join(i["name"] for i in items)),
        "items": items,
        "total_calories": total_calories,
        "total_protein_g": total_protein,
        "total_carbs_g": total_carbs,
        "total_fat_g": total_fat,
        "uncertainty_percent": uncertainty,
        "uncertainty_reason": str(data.get("uncertainty_reason") or "Portion sizes are estimated from a photo."),
    }
