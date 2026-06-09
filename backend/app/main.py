from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from .bootstrap import bootstrap_application
from .config import settings
from .routers import analytics, bookings, data_control, events, favorites, notifications, reports, reviews, tour_plans, tours, users

bootstrap_application()

app = FastAPI(title=settings.app_name, version=settings.app_version)
media_directory = Path(__file__).resolve().parents[1] / "storage" / "media"
media_directory.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_directory), name="media")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(users.router)
app.include_router(tours.router)
app.include_router(bookings.router)
app.include_router(tour_plans.router)
app.include_router(reviews.router)
app.include_router(favorites.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(data_control.router)
app.include_router(events.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"message": f"{settings.app_name} is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
