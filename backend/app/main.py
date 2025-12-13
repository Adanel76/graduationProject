from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import users, tours, bookings, reviews

app = FastAPI(title="Tourism Agency API", version="1.0.0")

# ПРАВИЛЬНАЯ настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Подключаем роутеры
app.include_router(users.router)
app.include_router(tours.router)
app.include_router(bookings.router)
app.include_router(reviews.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Tourism Agency API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
