"""Nutrition service — business logic for nutrition tracking."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NutritionLog


async def get_daily_nutrition(
    db: AsyncSession, user_id: str, target_date: date | None = None
) -> dict:
    """Get aggregated nutrition totals for a date."""
    if target_date is None:
        target_date = date.today()

    result = await db.execute(
        select(NutritionLog).where(
            NutritionLog.user_id == user_id,
            func.date(NutritionLog.date) == target_date,
        )
    )
    logs = result.scalars().all()

    return {
        "date": str(target_date),
        "total_calories": sum(l.calories or 0 for l in logs),
        "total_protein_g": sum(l.protein_g or 0 for l in logs),
        "total_carbs_g": sum(l.carbs_g or 0 for l in logs),
        "total_fat_g": sum(l.fat_g or 0 for l in logs),
        "total_fiber_g": sum(l.fiber_g or 0 for l in logs),
        "meal_count": len(logs),
        "meals": [
            {
                "id": l.id,
                "meal_type": l.meal_type,
                "raw_input": l.raw_input,
                "calories": l.calories,
                "protein_g": l.protein_g,
                "carbs_g": l.carbs_g,
                "fat_g": l.fat_g,
            }
            for l in logs
        ],
    }


async def get_nutrition_logs(
    db: AsyncSession, user_id: str, days_back: int = 7
) -> list[NutritionLog]:
    """Get recent nutrition logs."""
    cutoff = date.today() - timedelta(days=days_back)
    result = await db.execute(
        select(NutritionLog)
        .where(
            NutritionLog.user_id == user_id,
            func.date(NutritionLog.date) >= cutoff,
        )
        .order_by(NutritionLog.date.desc(), NutritionLog.created_at.desc())
    )
    return list(result.scalars().all())
