"""Pydantic validation models for nutrition agent."""

import re
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


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

    @model_validator(mode="after")
    def macro_consistency(self):
        """If calories don't match macro breakdown by >50%, auto-correct from macros.

        Formula: protein*4 + carbs*4 + fat*9 ≈ calories.
        Trusts the macro breakdown over the calorie number since Haiku is
        more likely to get individual macros right than the total.
        """
        if all(v is not None for v in [self.calories, self.protein_g, self.carbs_g, self.fat_g]):
            computed = self.protein_g * 4 + self.carbs_g * 4 + self.fat_g * 9
            if computed > 0 and self.calories > 0:
                ratio = self.calories / computed
                if ratio > 1.5 or ratio < 0.5:
                    self.calories = round(computed)
        return self

    @model_validator(mode="after")
    def single_item_calorie_ceiling(self):
        """One serving shouldn't exceed ~3000 cal (a full pizza)."""
        if self.quantity == 1 and self.calories is not None and self.calories > 3000:
            self.calories = 3000.0
        return self
