"""
Application configuration using Pydantic Settings
Loads from environment variables and .env file
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # Service Configuration
    service_name: str = "nlp-service"
    service_host: str = "0.0.0.0"
    service_port: int = 8000
    debug: bool = False
    log_level: str = "INFO"
    
    # Ollama LLM Configuration
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:latest"
    ollama_timeout: int = 120
    ollama_max_retries: int = 3
    
    # LLM Parameters
    llm_temperature: float = 0.7
    llm_top_p: float = 0.9
    llm_top_k: int = 40
    llm_max_tokens: int = 500
    
    # Redis Cache Configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 2
    cache_ttl_days: int = 30
    cache_key_prefix: str = "nlp:"
    
    # Text Processing Configuration
    chunk_size_words: int = 800
    chunk_overlap_words: int = 200
    min_chunk_words: int = 200
    max_chunk_words: int = 1200
    
    # Quality Thresholds
    min_quality_score: float = 0.4
    auto_approve_score: float = 0.6
    
    @property
    def cache_ttl_seconds(self) -> int:
        """Convert TTL days to seconds."""
        return self.cache_ttl_days * 24 * 60 * 60
    
    @property
    def ollama_generate_url(self) -> str:
        """Full URL for Ollama generate endpoint."""
        return f"{self.ollama_base_url}/api/generate"
    
    @property
    def ollama_tags_url(self) -> str:
        """Full URL for Ollama tags endpoint (list models)."""
        return f"{self.ollama_base_url}/api/tags"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance for convenience
settings = get_settings()
