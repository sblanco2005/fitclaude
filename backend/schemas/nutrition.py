from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class NutritionLogResponse(BaseModel):
    id: int
    user_id: int
    date: date
    meal_type: Optional[str] = None
    raw_input: str
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    confidence: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyNutritionSummary(BaseModel):
    date: date
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_fiber_g: float
    meal_count: int
