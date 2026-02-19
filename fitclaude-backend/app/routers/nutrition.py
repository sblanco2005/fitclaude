from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.nutrition import DailyNutritionSummary, NutritionLogResponse
from app.services.nutrition_service import get_daily_nutrition, get_nutrition_logs

router = APIRouter(prefix="/api/users/{user_id}/nutrition", tags=["nutrition"])


@router.get("/today", response_model=DailyNutritionSummary)
async def today_nutrition(user_id: str, db: AsyncSession = Depends(get_db)):
    totals = await get_daily_nutrition(db, user_id, date.today())
    return DailyNutritionSummary(
        date=date.today(),
        total_calories=totals["total_calories"],
        total_protein_g=totals["total_protein_g"],
        total_carbs_g=totals["total_carbs_g"],
        total_fat_g=totals["total_fat_g"],
        total_fiber_g=totals["total_fiber_g"],
        meal_count=totals["meal_count"],
    )


@router.get("/history", response_model=list[NutritionLogResponse])
async def nutrition_history(
    user_id: str, days_back: int = 7, db: AsyncSession = Depends(get_db)
):
    return await get_nutrition_logs(db, user_id, days_back)
