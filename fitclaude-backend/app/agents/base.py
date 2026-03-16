"""Base class for all FitClaude agents."""

from abc import ABC, abstractmethod
from anthropic import AsyncAnthropic


class BaseAgent(ABC):
    """Shared interface for all agents."""

    def __init__(self, client: AsyncAnthropic, model: str):
        self.client = client
        self.model = model

    @abstractmethod
    async def handle(self, user_message: str, **kwargs) -> dict:
        """Process a user message and return a result dict."""
        ...
