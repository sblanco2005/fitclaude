from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserFood(Base):
    __tablename__ = "user_foods"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    serving_amount: Mapped[float] = mapped_column("servingAmount", Float, nullable=False)
    serving_unit: Mapped[str] = mapped_column("servingUnit", String, nullable=False)
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column("proteinG", Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column("carbsG", Float, nullable=False)
    fat_g: Mapped[float] = mapped_column("fatG", Float, nullable=False)
    fiber_g: Mapped[Optional[float]] = mapped_column("fiberG", Float, nullable=True)
    times_used: Mapped[int] = mapped_column("timesUsed", Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("userId", "name", name="user_foods_userId_name_key"),
    )
