from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    date: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    meal_type: Mapped[Optional[str]] = mapped_column("mealType", String, nullable=True)
    raw_input: Mapped[str] = mapped_column("rawInput", Text)
    parsed_items: Mapped[Optional[str]] = mapped_column(
        "parsedItems", Text, nullable=True
    )
    calories: Mapped[Optional[float]] = mapped_column(nullable=True)
    protein_g: Mapped[Optional[float]] = mapped_column("proteinG", nullable=True)
    carbs_g: Mapped[Optional[float]] = mapped_column("carbsG", nullable=True)
    fat_g: Mapped[Optional[float]] = mapped_column("fatG", nullable=True)
    fiber_g: Mapped[Optional[float]] = mapped_column("fiberG", nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column("imageUrl", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="nutrition_logs")  # noqa: F821
