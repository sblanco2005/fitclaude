"""Agent registry — all agents are instantiated here and importable from app.agents."""

from anthropic import AsyncAnthropic
from app.config import settings
from app.agents.nutrition.agent import NutritionAgent
# from app.agents.workout.agent import WorkoutAgent  # future

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

nutrition_agent = NutritionAgent(client, model=settings.haiku_model)
# workout_agent = WorkoutAgent(client, model=settings.agent_model)  # future
