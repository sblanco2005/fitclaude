from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    email: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_goal: Optional[str] = None
    experience_level: Optional[str] = None
    gym_type: Optional[str] = None
    injuries_notes: Optional[str] = None
    equipment_text: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    daily_protein_target: Optional[float] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_goal: Optional[str] = None
    experience_level: Optional[str] = None
    gym_type: Optional[str] = None
    injuries_notes: Optional[str] = None
    equipment_text: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    daily_protein_target: Optional[float] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_goal: Optional[str] = None
    experience_level: Optional[str] = None
    gym_type: Optional[str] = None
    injuries_notes: Optional[str] = None
    equipment_text: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    daily_protein_target: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}
