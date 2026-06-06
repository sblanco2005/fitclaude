"""Agent registry — all agents are instantiated here and importable from app.agents."""

from anthropic import AsyncAnthropic
from app.config import settings
from app.agents.nutrition.agent import NutritionAgent
from app.agents.nutrition.vision_agent import VisionNutritionAgent
# from app.agents.workout.agent import WorkoutAgent  # future

# Pure Anthropic client — only reachable when Anthropic credits exist.
client = AsyncAnthropic(api_key=settings.anthropic_api_key)

# When configured, run on MiniMax — its endpoint is Anthropic-API compatible and
# vision-capable (handles image content blocks), so both text and food-photo
# nutrition agents use it. Falls back to Anthropic when no MiniMax is configured.
if settings.agent_base_url:
    agent_client = AsyncAnthropic(
        api_key=settings.minimax_api_key or settings.anthropic_api_key,
        base_url=settings.agent_base_url,
    )
    agent_model = settings.agent_model
else:
    agent_client = client
    agent_model = settings.haiku_model

nutrition_agent = NutritionAgent(agent_client, model=agent_model)
vision_nutrition_agent = VisionNutritionAgent(agent_client, model=agent_model)
# workout_agent = WorkoutAgent(client, model=settings.agent_model)  # future
