from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


def ensure_notification_settings(db: Session, user_id: int) -> models.UserNotificationSettings:
    settings = (
        db.query(models.UserNotificationSettings)
        .filter(models.UserNotificationSettings.user_id == user_id)
        .first()
    )

    if settings:
        return settings

    settings = models.UserNotificationSettings(
        user_id=user_id,
        email_booking_confirmation=True,
        email_booking_updates=True,
        email_newsletter=False,
        email_promotions=False,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/", response_model=List[schemas.NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .all()
    )

    return notifications


@router.get("/unread-count")
def get_unread_notifications_count(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    unread_count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read.is_(False),
        )
        .count()
    )

    return {"unread_count": unread_count}


@router.patch("/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = notification.read_at or models.func.now()
        db.commit()
        db.refresh(notification)

    return notification


@router.patch("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    unread_notifications = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read.is_(False),
        )
        .all()
    )

    changed = 0
    for notification in unread_notifications:
        notification.is_read = True
        if notification.read_at is None:
            notification.read_at = models.func.now()
        changed += 1

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated_count": changed,
    }


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"message": "Notification deleted successfully"}


@router.get("/settings", response_model=schemas.NotificationSettingsResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    settings = ensure_notification_settings(db, current_user.id)
    return settings


@router.put("/settings", response_model=schemas.NotificationSettingsResponse)
def update_notification_settings(
    settings_data: schemas.NotificationSettings,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    settings = ensure_notification_settings(db, current_user.id)

    settings.email_booking_confirmation = settings_data.email_booking_confirmation
    settings.email_booking_updates = settings_data.email_booking_updates
    settings.email_newsletter = settings_data.email_newsletter
    settings.email_promotions = settings_data.email_promotions

    db.commit()
    db.refresh(settings)

    return settings