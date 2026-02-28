"""Token usage tracking and rate limiting service."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from cuid2 import Cuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_usage import TokenUsage, UserUsageLimit

logger = logging.getLogger(__name__)
cuid_generator = Cuid()

# Pricing per 1M tokens
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-20250514": {
        "input": 3.00,
        "output": 15.00,
        "cache_write": 3.75,
        "cache_read": 0.30,
    },
    "claude-haiku-4-5-20251001": {
        "input": 0.80,
        "output": 4.00,
        "cache_write": 1.00,
        "cache_read": 0.08,
    },
}

DEFAULT_PRICING: dict[str, float] = {
    "input": 3.00,
    "output": 15.00,
    "cache_write": 3.75,
    "cache_read": 0.30,
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation_tokens: int = 0,
    cache_read_tokens: int = 0,
) -> float:
    """Calculate estimated cost in USD for a single API call."""
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    cost = (
        (input_tokens / 1_000_000) * pricing["input"]
        + (output_tokens / 1_000_000) * pricing["output"]
        + (cache_creation_tokens / 1_000_000) * pricing["cache_write"]
        + (cache_read_tokens / 1_000_000) * pricing["cache_read"]
    )
    return round(cost, 6)


async def log_token_usage(
    db: AsyncSession,
    user_id: str,
    endpoint: str,
    model: str,
    usage: object,
    request_id: Optional[str] = None,
) -> None:
    """Log a single API call's token usage to the database.

    Fire-and-forget — errors are logged but never propagate.
    """
    try:
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0

        cost = calculate_cost(
            model, input_tokens, output_tokens, cache_creation, cache_read
        )

        record = TokenUsage(
            id=cuid_generator.generate(),
            user_id=user_id,
            endpoint=endpoint,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation,
            cache_read_tokens=cache_read,
            estimated_cost_usd=cost,
            request_id=request_id,
        )
        db.add(record)
        await db.flush()

        logger.debug(
            f"[Usage] user={user_id} endpoint={endpoint} "
            f"in={input_tokens} out={output_tokens} cost=${cost:.4f}"
        )
    except Exception as e:
        logger.error(f"[Usage] Failed to log token usage: {e}")


async def check_rate_limit(
    db: AsyncSession,
    user_id: str,
) -> tuple[bool, str | None]:
    """Check if a user has exceeded their rate limits.

    Returns (allowed, reason). If not allowed, reason explains why.
    """
    result = await db.execute(
        select(UserUsageLimit).where(UserUsageLimit.user_id == user_id)
    )
    limits = result.scalar_one_or_none()

    if not limits:
        return True, None  # No limits configured

    if limits.is_throttled:
        return False, "Your account has been temporarily limited by an administrator."

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Daily limit
    if limits.max_calls_per_day is not None:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count(TokenUsage.id)).where(
                TokenUsage.user_id == user_id,
                TokenUsage.created_at >= day_start,
            )
        )
        daily_count = count_result.scalar() or 0
        if daily_count >= limits.max_calls_per_day:
            return (
                False,
                f"Daily limit reached ({limits.max_calls_per_day} calls/day). Resets at midnight UTC.",
            )

    # Weekly limit
    if limits.max_calls_per_week is not None:
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count(TokenUsage.id)).where(
                TokenUsage.user_id == user_id,
                TokenUsage.created_at >= week_start,
            )
        )
        weekly_count = count_result.scalar() or 0
        if weekly_count >= limits.max_calls_per_week:
            return (
                False,
                f"Weekly limit reached ({limits.max_calls_per_week} calls/week). Resets Monday.",
            )

    # Monthly limit
    if limits.max_calls_per_month is not None:
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        count_result = await db.execute(
            select(func.count(TokenUsage.id)).where(
                TokenUsage.user_id == user_id,
                TokenUsage.created_at >= month_start,
            )
        )
        monthly_count = count_result.scalar() or 0
        if monthly_count >= limits.max_calls_per_month:
            return (
                False,
                f"Monthly limit reached ({limits.max_calls_per_month} calls/month). Resets on the 1st.",
            )

    # Monthly cost limit
    if limits.max_cost_per_month is not None:
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cost_result = await db.execute(
            select(func.sum(TokenUsage.estimated_cost_usd)).where(
                TokenUsage.user_id == user_id,
                TokenUsage.created_at >= month_start,
            )
        )
        monthly_cost = cost_result.scalar() or 0.0
        if monthly_cost >= limits.max_cost_per_month:
            return (
                False,
                f"Monthly cost limit reached (${limits.max_cost_per_month:.2f}/month). Resets on the 1st.",
            )

    return True, None
