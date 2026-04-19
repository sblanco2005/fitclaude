from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = ""
    agent_model: str = "MiniMax-M2.7"
    agent_base_url: str = ""
    haiku_model: str = "claude-haiku-4-5-20251001"
    debug: bool = False

    # MiniMax fallback
    minimax_api_key: str = ""
    minimax_model: str = "MiniMax-M2.7"

    # Qwen vision
    qwen_api_key: str = ""
    qwen_model: str = "qwen-vl-plus"

    # YouTube subagent
    youtube_api_key: str = ""
    job_api_key: str = ""
    youtube_discovery_channels: str = "Jeff Nippard,Renaissance Periodization,AthleanX,Jeremy Ethier"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
