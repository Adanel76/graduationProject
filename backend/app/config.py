import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Загружаем основной .env, а затем локальный .env.local с приоритетом.
# .env.local удобно хранить для SMTP-пароля и не перезаписывать при обновлении проекта.
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)
load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _build_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url and database_url.strip():
        return database_url.strip()

    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")

    if not all([db_user, db_password, db_name]):
        raise RuntimeError(
            "Не задана конфигурация PostgreSQL. "
            "Укажи DATABASE_URL или набор DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_NAME."
        )

    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Tourism Agency API")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")

    database_url: str = _build_database_url()

    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production")
    algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    auto_create_tables: bool = _as_bool(os.getenv("AUTO_CREATE_TABLES"), True)
    auto_seed_reference_data: bool = _as_bool(os.getenv("AUTO_SEED_REFERENCE_DATA"), True)
    auto_seed_demo_data: bool = _as_bool(os.getenv("AUTO_SEED_DEMO_DATA"), False)

    cors_allow_origins: str = os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )

    email_enabled: bool = _as_bool(os.getenv("EMAIL_ENABLED"), False)
    email_timeout: int = int(os.getenv("EMAIL_TIMEOUT", "6"))
    email_host: str = os.getenv("EMAIL_HOST", "")
    email_port: int = int(os.getenv("EMAIL_PORT", "587"))
    email_from: str = os.getenv("EMAIL_FROM", "")
    email_username: str = os.getenv("EMAIL_USERNAME", os.getenv("EMAIL_FROM", ""))
    email_password: str = os.getenv("EMAIL_PASSWORD", "")
    email_use_tls: bool = _as_bool(os.getenv("EMAIL_USE_TLS"), True)
    email_use_ssl: bool = _as_bool(os.getenv("EMAIL_USE_SSL"), False)
    email_from_name: str = os.getenv("EMAIL_FROM_NAME", "Travel Agency")
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/")

    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allow_origins.split(",") if item.strip()]

    def email_is_configured(self) -> bool:
        return all([self.email_host, self.email_port, self.email_from, self.email_username, self.email_password])

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url


settings = Settings()