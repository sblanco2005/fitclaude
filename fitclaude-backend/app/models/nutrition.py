from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
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


class DailyNutritionSummary(Base):
    __tablename__ = "daily_nutrition_summaries"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    date: Mapped[date] = mapped_column(Date)
    calories: Mapped[float] = mapped_column(Float, default=0)
    protein_g: Mapped[float] = mapped_column("proteinG", Float, default=0)
    carbs_g: Mapped[float] = mapped_column("carbsG", Float, default=0)
    fat_g: Mapped[float] = mapped_column("fatG", Float, default=0)
    fiber_g: Mapped[float] = mapped_column("fiberG", Float, default=0)
    meal_count: Mapped[int] = mapped_column("mealCount", Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="nutrition_summaries")  # noqa: F821

    __table_args__ = (
        UniqueConstraint("userId", "date", name="uq_user_date"),
    )
