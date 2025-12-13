from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/user-behavior")
def get_user_behavior(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Получить данные о поведении пользователя"""
    # В реальном приложении здесь будет сложная аналитика
    return {
        "total_views": 0,
        "favorite_tours": [],
        "search_history": [],
        "booking_patterns": {}
    }

@router.get("/recommendations")
def get_recommendations(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Получить персональные рекомендации"""
    # Алгоритм рекомендаций на основе предпочтений пользователя
    return []

@router.post("/track-event")
def track_event(
    event_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Отслеживать пользовательские события"""
    event = models.AnalyticsEvent(
        user_id=current_user.id if current_user else None,
        event_type=event_data.get("event_type"),
        event_data=str(event_data),
        ip_address=event_data.get("ip_address", ""),
        user_agent=event_data.get("user_agent", "")
    )
    db.add(event)
    db.commit()
    return {"status": "tracked"}
