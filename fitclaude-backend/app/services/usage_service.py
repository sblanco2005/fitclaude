"""Token usage tracking and rate limiting service."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from cuid2 import Cuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_usage import TokenUsage, UserUsageLimit
from app.models.user import User

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


# ── Tier Configuration ──


@dataclass
class TierConfig:
    max_messages_per_day: int | None  # None = unlimited
    allowed_models: list[str]  # model IDs the tier can access
    default_model: str  # model used by default


TIER_CONFIGS: dict[str, TierConfig] = {
    "free": TierConfig(
        max_messages_per_day=20,
        allowed_models=["claude-haiku-4-5-20251001"],
        default_model="claude-haiku-4-5-20251001",
    ),
    "pro": TierConfig(
        max_messages_per_day=100,
        allowed_models=["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"],
        default_model="claude-haiku-4-5-20251001",  # Haiku default, Sonnet for complex
    ),
    "unlimited": TierConfig(
        max_messages_per_day=None,
        allowed_models=["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"],
        default_model="claude-sonnet-4-20250514",
    ),
}


def get_tier_config(tier: str) -> TierConfig:
    """Return the config for a given tier, defaulting to 'free'."""
    return TIER_CONFIGS.get(tier, TIER_CONFIGS["free"])


async def get_model_for_tier(
    db: AsyncSession,
    user_id: str,
) -> str:
    """Determine which model to use based on user tier.

    Free  → always Haiku
    Pro   → Haiku by default (Sonnet available for complex requests)
    Unlimited → Sonnet
    """
    result = await db.execute(
        select(User.tier).where(User.id == user_id)
    )
    tier = result.scalar_one_or_none() or "free"
    config = get_tier_config(tier)
    return config.default_model


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

    Uses a two-layer approach:
    1. Tier-based defaults (Free=20/day, Pro=100/day, Unlimited=no limit)
    2. Admin-set UserUsageLimit overrides (take precedence when set)

    Returns (allowed, reason). If not allowed, reason explains why.
    """
    # Load user tier
    user_result = await db.execute(
        select(User.tier).where(User.id == user_id)
    )
    tier = user_result.scalar_one_or_none() or "free"
    tier_config = get_tier_config(tier)

    # Load admin-set limits (if any)
    result = await db.execute(
        select(UserUsageLimit).where(UserUsageLimit.user_id == user_id)
    )
    limits = result.scalar_one_or_none()

    # Admin throttle is always respected
    if limits and limits.is_throttled:
        return False, "Your account has been temporarily limited by an administrator."

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Daily limit: admin override > tier default
    effective_daily = (
        limits.max_calls_per_day if (limits and limits.max_calls_per_day is not None)
        else tier_config.max_messages_per_day
    )
    if effective_daily is not None:
        count_result = await db.execute(
            select(func.count(TokenUsage.id)).where(
                TokenUsage.user_id == user_id,
                TokenUsage.created_at >= day_start,
            )
        )
        daily_count = count_result.scalar() or 0
        if daily_count >= effective_daily:
            tier_label = tier.capitalize()
            return (
                False,
                f"Daily message limit reached ({effective_daily}/day on {tier_label} tier). Resets at midnight UTC.",
            )

    # Weekly limit (admin-only, no tier default)
    if limits and limits.max_calls_per_week is not None:
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

    # Monthly limit (admin-only, no tier default)
    if limits and limits.max_calls_per_month is not None:
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

    # Monthly cost limit (admin-only)
    if limits and limits.max_cost_per_month is not None:
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
