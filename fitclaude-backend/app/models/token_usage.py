from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TokenUsage(Base):
    __tablename__ = "token_usage"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    endpoint: Mapped[str] = mapped_column(String)  # "chat", "analytics", "chat_retry"
    model: Mapped[str] = mapped_column(String)
    input_tokens: Mapped[int] = mapped_column("inputTokens", Integer, default=0)
    output_tokens: Mapped[int] = mapped_column("outputTokens", Integer, default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(
        "cacheCreationTokens", Integer, default=0
    )
    cache_read_tokens: Mapped[int] = mapped_column(
        "cacheReadTokens", Integer, default=0
    )
    estimated_cost_usd: Mapped[float] = mapped_column(
        "estimatedCostUsd", Float, default=0.0
    )
    request_id: Mapped[Optional[str]] = mapped_column(
        "requestId", String, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="token_usages")  # noqa: F821


class UserUsageLimit(Base):
    __tablename__ = "user_usage_limits"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        "userId", ForeignKey("users.id"), unique=True
    )
    max_calls_per_day: Mapped[Optional[int]] = mapped_column(
        "maxCallsPerDay", Integer, nullable=True
    )
    max_calls_per_week: Mapped[Optional[int]] = mapped_column(
        "maxCallsPerWeek", Integer, nullable=True
    )
    max_calls_per_month: Mapped[Optional[int]] = mapped_column(
        "maxCallsPerMonth", Integer, nullable=True
    )
    max_cost_per_month: Mapped[Optional[float]] = mapped_column(
        "maxCostPerMonth", Float, nullable=True
    )
    is_throttled: Mapped[bool] = mapped_column(
        "isThrottled", Boolean, default=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="usage_limit")  # noqa: F821
