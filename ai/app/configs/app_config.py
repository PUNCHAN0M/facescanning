from typing import Literal
from pydantic import AnyUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    PROJECT_NAME: str = "AI"
    API_STR: str = "/api"
    SECRET_KEY: str = "secret_key"
    ALGORITHM: str = "HS256"

    SERVER_URL: str = "http://localhost:8080" + API_STR

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: list[AnyUrl] | str = []

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "redis_secret"

    @property
    def all_cors_origins(self) -> list[str]:
        if isinstance(self.BACKEND_URL, str):
            return self.BACKEND_URL.split(",") + [self.FRONTEND_URL]
        return [str(origin) for origin in self.BACKEND_URL] + [self.FRONTEND_URL]


app_config = AppConfig()
