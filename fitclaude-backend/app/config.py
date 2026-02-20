from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = ""
    agent_model: str = "claude-sonnet-4-20250514"
    haiku_model: str = "claude-haiku-4-5-20251001"
    debug: bool = False

    # YouTube subagent
    youtube_api_key: str = ""
    job_api_key: str = ""
    youtube_discovery_channels: str = "Jeff Nippard,Renaissance Periodization,AthleanX,Jeremy Ethier"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
