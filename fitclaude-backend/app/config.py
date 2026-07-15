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

    # Meta Model API (Muse Spark) — Anthropic Messages-compatible, Bearer auth.
    # When model_api_key is set and use_meta is true, the coach runs on Meta
    # (native tool calling); MiniMax stays as the on-error fallback.
    model_api_key: str = ""
    meta_base_url: str = "https://api.meta.ai"
    meta_model: str = "muse-spark-1.1"
    use_meta: bool = False
    # Reasoning models spend "thinking" tokens against max_tokens — give the
    # coach a generous budget so output isn't starved (empty replies otherwise).
    meta_max_tokens: int = 4096

    # Qwen vision
    qwen_api_key: str = ""
    qwen_model: str = "qwen3-vl-plus"
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # YouTube subagent
    youtube_api_key: str = ""
    job_api_key: str = ""
    youtube_discovery_channels: str = "Jeff Nippard,Renaissance Periodization,AthleanX,Jeremy Ethier"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
