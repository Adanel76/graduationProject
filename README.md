# Travel Agency

Информационно-аналитическая система туристического агентства, разработанная
как выпускной квалификационный проект. Приложение объединяет каталог туров,
бронирование, индивидуальный конструктор путешествий, административную панель,
аналитику и локальный ML-модуль MetricBot.

## Основные возможности

- регистрация, подтверждение email и авторизация пользователей;
- роли клиента, менеджера, аналитика и администратора;
- каталог туров с фильтрацией, избранным, отзывами и уникальными изображениями;
- просмотр тура и пошаговое оформление бронирования;
- конструктор индивидуального тура с городами, базовыми турами, мероприятиями,
  пакетом услуг и редактируемой программой по дням;
- личный кабинет с бронированиями и подробным просмотром индивидуальных планов;
- управление турами, мероприятиями, пользователями и заявками в админ-панели;
- отчёты, CSV-импорт и экспорт, контроль качества данных;
- BI-аналитика и локальная ML-модель MetricBot для прогнозирования показателей.

## Технологии

**Frontend:** React 19, React Router, Axios, Recharts, CSS.

**Backend:** FastAPI, SQLAlchemy, Pydantic, PostgreSQL, JWT.

**ML и данные:** pandas, scikit-learn, joblib, CSV/XLSX.

**Тестирование:** Pytest, React Testing Library, GitHub Actions.

## Структура проекта

```text
backend/                 FastAPI API, модели БД, ML и тесты
frontend/                React-приложение
backend/storage/media/   изображения каталога
backend/storage/ml_models/ локальные модели MetricBot
scripts/                 резервное копирование и сценарии демонстрации
.github/workflows/       автоматическая проверка проекта
```

## Локальный запуск

### 1. База данных

Создайте PostgreSQL-базу и скопируйте пример конфигурации:

```powershell
Copy-Item backend\.env.example backend\.env
```

Укажите актуальный `DATABASE_URL` и замените `SECRET_KEY` в `backend/.env`.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API будет доступно по адресу `http://localhost:8000`, документация Swagger:
`http://localhost:8000/docs`.

### 3. Frontend

В отдельном терминале:

```powershell
cd frontend
npm install
npm start
```

Интерфейс откроется по адресу `http://localhost:3000`.

## Проверка

```powershell
cd frontend
npm run build
npm run test:frontend

cd ..\backend
pytest
```

Дополнительные сведения о тестировании находятся в [TESTING.md](TESTING.md).

## Конфиденциальные данные

Файлы `.env`, локальные базы данных, виртуальные окружения, журналы и сборки
исключены из Git. В репозитории находятся только примеры конфигурации без
рабочих паролей и ключей.
