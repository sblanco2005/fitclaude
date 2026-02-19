from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    date: Mapped[datetime] = mapped_column(DateTime)
    meal_type: Mapped[Optional[str]] = mapped_column("mealType", String, nullable=True)
    raw_input: Mapped[str] = mapped_column("rawInput", Text)
    parsed_items: Mapped[Optional[str]] = mapped_column("parsedItems", Text, nullable=True)
    calories: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    protein_g: Mapped[Optional[float]] = mapped_column("proteinG", Float, nullable=True)
    carbs_g: Mapped[Optional[float]] = mapped_column("carbsG", Float, nullable=True)
    fat_g: Mapped[Optional[float]] = mapped_column("fatG", Float, nullable=True)
    fiber_g: Mapped[Optional[float]] = mapped_column("fiberG", Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)

    user: Mapped["User"] = relationship(back_populates="nutrition_logs")  # noqa: F821
