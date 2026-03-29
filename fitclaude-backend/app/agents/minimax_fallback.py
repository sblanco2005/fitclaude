"""
Anthropic Haiku fallback — conversational only (no tool-use).

Used when the primary API (MiniMax) is overloaded or unavailable. Provides a
degraded but functional chat experience: the coach can talk, but cannot save
workouts or log nutrition.
"""

import logging

from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)

FALLBACK_NOTE = (
    "\n\nNOTE: You are currently operating in fallback mode because the primary AI service "
    "is temporarily unavailable. You CANNOT save workouts or log nutrition right now. "
    "If the user asks to generate a workout or log food, acknowledge the request and "
    "tell them you'll save it once the service is restored. You can still have a normal "
    "conversation, answer fitness questions, and give advice."
)


async def handle_chat_fallback(
    user_message: str,
    history: list[dict],
    system_prompt: str,
) -> str:
    """
    Fallback chat handler using Anthropic Haiku.

    Returns the assistant's text response. Raises on failure so the caller
    can fall through to the generic error handler.
    """
    if not settings.anthropic_api_key:
        raise RuntimeError("Anthropic API key not configured")

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Build Anthropic-format messages
    messages: list[dict] = []

    for msg in history:
        content = msg.get("content", "")
        if not isinstance(content, str):
            if isinstance(content, list):
                content = " ".join(
                    block.get("text", "") if isinstance(block, dict) else str(block)
                    for block in content
                )
            else:
                content = str(content)
        messages.append({"role": msg["role"], "content": content})

    messages.append({"role": "user", "content": user_message})

    logger.info(f"[Fallback] Calling {settings.haiku_model} with {len(messages)} messages")

    response = await client.messages.create(
        model=settings.haiku_model,
        system=system_prompt + FALLBACK_NOTE,
        messages=messages,
        max_tokens=2048,
    )

    text = response.content[0].text if response.content else ""
    logger.info(f"[Fallback] Response received ({len(text)} chars)")
    return text
