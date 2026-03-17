"""Pydantic validation models for nutrition agent."""

import re
from typing import Optional

from pydantic import BaseModel, field_validator


class FoodItem(BaseModel):
    name: str
    quantity: float = 1.0
    unit: str = "serving"
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    estimated: bool = True
    barcode: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_have_letter(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1 or not re.search(r"[a-zA-Z]", v):
            raise ValueError("name must contain at least one letter")
        return v[:200]

    @field_validator("quantity", mode="before")
    @classmethod
    def quantity_default(cls, v):
        if v is None or v == 0:
            return 1.0
        v = float(v)
        if v <= 0:
            return 1.0
        if v > 50:
            return 50.0
        return v

    @field_validator("unit", mode="before")
    @classmethod
    def unit_default(cls, v):
        if not v:
            return "serving"
        return str(v)[:50]

    @field_validator("calories", "protein_g", "carbs_g", "fat_g", mode="before")
    @classmethod
    def clamp_macros(cls, v):
        if v is None:
            return None
        v = float(v)
        if v < 0:
            return 0.0
        if v > 10000:
            return 10000.0
        return v
