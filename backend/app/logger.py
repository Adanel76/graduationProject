from sqlalchemy.orm import Session
from . import models

def log_user_action(db: Session, user_id: int, action: str, description: str = "", ip_address: str = ""):
    """Логирование действий пользователя"""
    try:
        log_entry = models.UserLog(
            user_id=user_id,
            action=action,
            description=description,
            ip_address=ip_address
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Ошибка логирования: {e}")
        db.rollback()
