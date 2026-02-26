from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    duration_minutes: Mapped[Optional[int]] = mapped_column(
        "durationMinutes", nullable=True
    )
    date: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="activities")  # noqa: F821
