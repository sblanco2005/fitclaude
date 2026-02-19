from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    # Shared Neon URL from .env (also used by Prisma/Next.js).
    database_url: str = "sqlite+aiosqlite:///./fitclaude.db"
    agent_model: str = "claude-sonnet-4-20250514"
    debug: bool = False

    @property
    def async_database_url(self) -> str:
        """URL with the correct async driver and asyncpg-compatible query params."""
        url = self.database_url
        if not url.startswith("postgresql://"):
            return url

        # Switch to asyncpg driver
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Strip libpq-only params that asyncpg rejects (sslmode, channel_binding)
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop("sslmode", None)
        qs.pop("channel_binding", None)
        clean_query = urlencode({k: v[0] for k, v in qs.items()})
        return urlunparse(parsed._replace(query=clean_query))

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql://")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
