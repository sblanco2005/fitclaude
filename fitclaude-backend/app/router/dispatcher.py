"""Message dispatcher — routes messages to the correct agent or general handler."""

import logging

from app.router.intent import detect_food_logging_intent

logger = logging.getLogger(__name__)


def route_message(message: str, topic: str, has_image: bool = False) -> str:
    """
    Determine which handler should process this message.

    Returns:
        "nutrition_agent" — dedicated nutrition fast path
        "general" — full coach tool-use loop
    """
    # Images always go through the general handler (vision support needed)
    if has_image:
        return "general"

    # Nutrition topic + food logging intent → dedicated agent
    if topic == "nutrition" and message and detect_food_logging_intent(message):
        logger.info("[Dispatcher] Routing to nutrition_agent")
        return "nutrition_agent"

    # Everything else → general coach
    return "general"
