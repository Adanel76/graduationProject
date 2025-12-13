# Информационная система для туристического агентства

## 📋 Описание проекта

Веб-приложение, позволяющее управлять турами, бронированиями и отзывами клиентов. Система предоставляет 
различные интерфейсы для клиентов, менеджеров и администраторов.

### Основные функции:

- **Для клиентов:**
  - Просмотр каталога туров с фильтрацией и поиском
  - Бронирование туров с системой скидок
  - Оставление отзывов и оценок
  - Управление личным кабинетом
  - Система избранных туров
  - Восстановление пароля

- **Для менеджеров:**
  - Управление бронированиями
  - Просмотр и модерация отзывов
  - Работа с клиентами

- **Для администраторов:**
  - Управление турами (CRUD)
  - Управление пользователями
  - Аналитика и отчеты
  - Экспорт данных в CSV/Excel
  - Настройка системы

## 🛠️ Технологии

### Backend:
- **Python 3.8+**
- **FastAPI** - веб-фреймворк
- **PostgreSQL** - база данных
- **SQLAlchemy** - ORM
- **JWT** - аутентификация
- **SMTPLib** - отправка email

### Frontend:
- **React.js** - библиотека для создания пользовательского интерфейса
- **React Router** - маршрутизация
- **Axios** - HTTP клиент
- **CSS3** - стилизация

## 🚀 Установка и запуск

### Требования:
- Python 3.8+
- Node.js 14+
- PostgreSQL 12+
- Git

### Схема базы данных:
<img width="662" height="391" alt="image" src="https://github.com/user-attachments/assets/c915efaf-0783-4846-abc7-c84d2ba30941" />
<img width="811" height="249" alt="image" src="https://github.com/user-attachments/assets/f53f3b1b-4369-4dab-b936-561a8fdc9318" />
<img width="245" height="455" alt="image" src="https://github.com/user-attachments/assets/0d7eb144-6c03-4d83-b9c1-3ec1e7b9e7a2" />
<img width="567" height="472" alt="image" src="https://github.com/user-attachments/assets/f828b7e6-b2ff-4ef9-bdba-6945141735fb" />
<img width="225" height="611" alt="image" src="https://github.com/user-attachments/assets/2852ebdf-b53f-4525-9ce3-fb6699b5a54e" />
<img width="1919" height="1018" alt="image" src="https://github.com/user-attachments/assets/154b8c54-5366-4a64-9c92-b45b2be8192a" />

### Запуск Backend:
```
# В первой консоли переход в папку backend
cd backend

# Создание виртуального окружения
python -m venv venv

# Активация виртуального окружения
# Windows:
venv\Scripts\activate

# Установка зависимостей
pip install -r requirements.txt

# Запуск сервера
uvicorn app.main:app --reload
```
### Запуск Frontend:
```
# Во второй коносоли переход в папку frontend
cd frontend

# Установка зависимостей
npm install

# Запуск приложения
npm start
```

