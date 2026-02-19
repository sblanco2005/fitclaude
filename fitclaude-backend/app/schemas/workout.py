from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class WorkoutExerciseResponse(BaseModel):
    id: str
    exercise_id: Optional[str] = None
    variation_id: Optional[str] = None
    order: int
    sets: int
    reps: Optional[str] = None
    weight_kg: Optional[float] = None
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None
    set_logs: Optional[str] = None
    was_spicy: bool = False

    model_config = {"from_attributes": True}


class WorkoutResponse(BaseModel):
    id: str
    user_id: str
    display_id: Optional[int] = None
    date: datetime
    name: Optional[str] = None
    workout_type: str
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    fatigue_rating: Optional[int] = None
    completed: bool
    created_at: datetime
    exercises: List[WorkoutExerciseResponse] = []

    model_config = {"from_attributes": True}
