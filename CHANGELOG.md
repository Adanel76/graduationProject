# Changelog

## 1.1.0 - production-grade MVP hardening

### Added
- Docker Compose для PostgreSQL, FastAPI и frontend.
- Dockerfile для backend и frontend.
- Alembic-миграции и production-режим без автоматического `create_all`.
- Refresh-сессии через HttpOnly cookie, logout и ротация refresh token.
- Хранение кодов сброса пароля в БД в хешированном виде.
- Rate limiting для auth/email-сценариев.
- Security headers middleware и `/ready` endpoint.
- CRM-поля бронирования: источник, приоритет, назначенный менеджер, комментарии, SLA-срок.
- Комментарии к бронированиям с разделением внутренних и клиентских записей.
- Индексы и уникальные ограничения для ключевых таблиц.
- GitHub Actions CI.
- Скрипты backup/restore PostgreSQL.

### Changed
- Удалены реальные секреты и локальная БД из поставки.
- Конфигурация вынесена в безопасные `.env.example` и переменные окружения.
- Frontend подготовлен к Vite-сборке.

### Security
- Убраны выводы кодов подтверждения и сброса в консоль.
- Смена пароля отзывает активные refresh-сессии пользователя.
