"""
MiniMax M2.5 fallback — conversational only (no tool-use).

Used when Anthropic's API is overloaded or unavailable. Provides a degraded
but functional chat experience: the coach can talk, but cannot save workouts
or log nutrition.
"""

import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

FALLBACK_NOTE = (
    "\n\nNOTE: You are currently operating in fallback mode because the primary AI service "
    "is temporarily unavailable. You CANNOT save workouts or log nutrition right now. "
    "If the user asks to generate a workout or log food, acknowledge the request and "
    "tell them you'll save it once the service is restored. You can still have a normal "
    "conversation, answer fitness questions, and give advice."
)


async def handle_chat_minimax(
    user_message: str,
    history: list[dict],
    system_prompt: str,
) -> str:
    """
    Fallback chat handler using MiniMax M2.5 via OpenAI-compatible API.

    Returns the assistant's text response. Raises on failure so the caller
    can fall through to the generic error handler.
    """
    if not settings.minimax_api_key:
        raise RuntimeError("MiniMax API key not configured")

    client = AsyncOpenAI(
        base_url="https://api.minimax.io/v1",
        api_key=settings.minimax_api_key,
    )

    # Build OpenAI-format messages
    messages: list[dict] = [
        {"role": "system", "content": system_prompt + FALLBACK_NOTE},
    ]

    # Convert history — coerce non-string content to strings
    for msg in history:
        content = msg.get("content", "")
        if not isinstance(content, str):
            # Handle Anthropic-style content blocks (list of dicts with "text" key)
            if isinstance(content, list):
                content = " ".join(
                    block.get("text", "") if isinstance(block, dict) else str(block)
                    for block in content
                )
            else:
                content = str(content)
        messages.append({"role": msg["role"], "content": content})

    messages.append({"role": "user", "content": user_message})

    logger.info(f"[MiniMax] Calling {settings.minimax_model} with {len(messages)} messages")

    completion = await client.chat.completions.create(
        model=settings.minimax_model,
        messages=messages,
        max_tokens=2048,
    )

    text = completion.choices[0].message.content or ""
    logger.info(f"[MiniMax] Response received ({len(text)} chars)")
    return text
