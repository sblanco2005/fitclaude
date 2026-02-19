from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class WorkoutExerciseResponse(BaseModel):
    id: int
    exercise_id: Optional[int] = None
    variation_id: Optional[int] = None
    order: int
    sets: int
    reps: Optional[str] = None
    weight_kg: Optional[float] = None
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None
    was_spicy: bool = False
    exercise_name: Optional[str] = None
    variation_name: Optional[str] = None

    model_config = {"from_attributes": True}


class WorkoutResponse(BaseModel):
    id: int
    user_id: int
    date: date
    name: Optional[str] = None
    workout_type: str
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    fatigue_rating: Optional[int] = None
    completed: bool
    created_at: datetime
    exercises: List[WorkoutExerciseResponse] = []

    model_config = {"from_attributes": True}
