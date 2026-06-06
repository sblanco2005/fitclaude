"""Agent registry — all agents are instantiated here and importable from app.agents."""

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from app.config import settings
from app.agents.nutrition.agent import NutritionAgent
from app.agents.nutrition.vision_agent import VisionNutritionAgent
# from app.agents.workout.agent import WorkoutAgent  # future

# Pure Anthropic client — only reachable when Anthropic credits exist.
client = AsyncAnthropic(api_key=settings.anthropic_api_key)

# Text extraction runs on MiniMax when configured (its endpoint is Anthropic-API
# compatible), since there are no Anthropic credits. Falls back to Anthropic otherwise.
if settings.agent_base_url:
    text_agent_client = AsyncAnthropic(
        api_key=settings.minimax_api_key or settings.anthropic_api_key,
        base_url=settings.agent_base_url,
    )
    text_agent_model = settings.agent_model
else:
    text_agent_client = client
    text_agent_model = settings.haiku_model

# Vision runs on Qwen (OpenAI-compatible) when configured — MiniMax can't accept
# Anthropic-style image blocks and Anthropic has no credits.
qwen_client = (
    AsyncOpenAI(api_key=settings.qwen_api_key, base_url=settings.qwen_base_url)
    if settings.qwen_api_key
    else None
)

nutrition_agent = NutritionAgent(text_agent_client, model=text_agent_model)
vision_nutrition_agent = VisionNutritionAgent(
    client,
    model=settings.haiku_model,
    qwen_client=qwen_client,
    qwen_model=settings.qwen_model,
)
# workout_agent = WorkoutAgent(client, model=settings.agent_model)  # future
