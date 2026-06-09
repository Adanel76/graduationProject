from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    normalize_email,
    oauth2_scheme,
)
from ..database import get_db
from ..email_utils import (
    generate_reset_code,
    generate_verification_code,
    send_reset_password_email,
    send_test_email,
    send_verification_email,
    send_welcome_email,
)
from ..logger import log_user_action

try:
    from ..export_utils import export_to_csv, export_to_excel, format_user_data_for_export
    EXPORTS_AVAILABLE = True
except Exception:
    EXPORTS_AVAILABLE = False

router = APIRouter(prefix="/users", tags=["users"])

# временное хранилище кодов сброса пароля
reset_codes = {}


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    if request.client:
        return request.client.host

    return None


def safe_log_user_action(
    db: Session,
    user_id: Optional[int],
    action: str,
    description: str,
    ip_address: Optional[str] = None,
):
    try:
        if user_id is not None:
            log_user_action(db, user_id, action, description, ip_address)
    except Exception as e:
        print(f"Ошибка логирования действия пользователя: {e}")


def get_current_user_from_token(token: str, db: Session):
    return auth.get_current_user_from_token(token, db)


def mark_user_online(db: Session, user: models.User):
    try:
        user.last_seen_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        print(f"Ошибка обновления online-статуса пользователя: {e}")
    return user


def require_admin(token: str, db: Session):
    current_user = get_current_user_from_token(token, db)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


def user_to_schema_data(user: models.User):
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar_data": user.avatar_data,
        "avatar_type": user.avatar_type,
        "role": user.role,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "last_seen_at": user.last_seen_at,
    }


# =========================
# SERVICE
# =========================

@router.get("/test")
def test_endpoint():
    return {"message": "Users API is working!", "status": "ok"}


@router.post("/test-email")
def send_test_email_to_current_user(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = get_current_user_from_token(token, db)

    if current_user.role not in {"admin", "manager", "analyst"}:
        raise HTTPException(status_code=403, detail="Недостаточно прав для проверки SMTP")

    background_tasks.add_task(send_test_email, current_user.email)

    return {
        "message": "Тестовое письмо поставлено в очередь отправки",
        "email": current_user.email,
    }


# =========================
# AUTH / REGISTRATION
# =========================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    user: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email(user.email)

    existing_user = (
        db.query(models.User)
        .filter(models.User.email == normalized_email)
        .first()
    )

    verification_code = generate_verification_code(6)
    verification_expires = datetime.utcnow() + timedelta(hours=24)

    # Если пользователь уже существует и подтвержден — запрещаем повторную регистрацию
    if existing_user and existing_user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Пользователь с таким email уже существует",
        )

    # Если пользователь есть, но email не подтвержден — обновляем данные и отправляем новый код
    if existing_user and not existing_user.is_verified:
        existing_user.first_name = user.first_name
        existing_user.last_name = user.last_name
        existing_user.phone = user.phone
        existing_user.password_hash = get_password_hash(user.password)
        existing_user.verification_code = verification_code
        existing_user.verification_code_expires = verification_expires

        db.commit()
        db.refresh(existing_user)

        print(f"VERIFICATION CODE for {normalized_email}: {verification_code}")

        background_tasks.add_task(
            send_verification_email,
            normalized_email,
            verification_code,
        )

        safe_log_user_action(
            db,
            existing_user.id,
            "REGISTER_RETRY",
            "Повторная регистрация неподтвержденного пользователя",
        )

        return {
            "message": "Аккаунт уже существует, но не подтвержден. Новый код отправлен на email.",
            "user_id": existing_user.id,
            "email": existing_user.email,
        }

    # Новый пользователь
    db_user = models.User(
        email=normalized_email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        password_hash=get_password_hash(user.password),
        role="client",
        is_verified=False,
        verification_code=verification_code,
        verification_code_expires=verification_expires,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    print(f"VERIFICATION CODE for {normalized_email}: {verification_code}")

    background_tasks.add_task(
        send_verification_email,
        normalized_email,
        verification_code,
    )

    safe_log_user_action(
        db,
        db_user.id,
        "REGISTER",
        "Пользователь зарегистрирован",
    )

    return {
        "message": "Пользователь зарегистрирован. Подтвердите email.",
        "user_id": db_user.id,
        "email": db_user.email,
    }


@router.post("/resend-code")
@router.post("/register/resend-code")
def resend_verification_code(
    request: schemas.ResendCodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email(request.email)

    user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.is_verified:
        return {"message": "Email уже подтвержден"}

    new_code = generate_verification_code(6)
    user.verification_code = new_code
    user.verification_code_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    print(f"VERIFICATION CODE for {normalized_email}: {new_code}")

    background_tasks.add_task(send_verification_email, normalized_email, new_code)

    return {"message": "Новый код подтверждения отправлен на ваш email"}


@router.post("/verify-email")
def verify_email(
    request: schemas.EmailVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email(request.email)

    user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.is_verified:
        return {"message": "Email уже подтвержден"}

    if not user.verification_code:
        raise HTTPException(status_code=400, detail="Код подтверждения не найден")

    if user.verification_code != request.code:
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")

    if user.verification_code_expires and user.verification_code_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Код подтверждения истек")

    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    db.commit()
    db.refresh(user)

    background_tasks.add_task(
        send_welcome_email,
        user.email,
        f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
    )

    safe_log_user_action(
        db,
        user.id,
        "VERIFY_EMAIL",
        "Email успешно подтвержден",
    )

    return {"message": "Email успешно подтвержден"}


@router.post("/login", response_model=schemas.Token)
def login(
    user: schemas.UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email(user.email)
    db_user = authenticate_user(db, normalized_email, user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email не подтвержден. Проверьте почту и подтвердите email.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": normalize_email(db_user.email),
            "user_id": db_user.id,
        },
        expires_delta=access_token_expires,
    )

    db_user.last_seen_at = datetime.utcnow()
    db.add(
        models.UserLoginHistory(
            user_id=db_user.id,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()

    safe_log_user_action(
        db,
        db_user.id,
        "LOGIN",
        "Успешный вход в систему",
        get_client_ip(request),
    )

    return {"access_token": access_token, "token_type": "bearer"}


# =========================
# CURRENT USER
# =========================

@router.get("/me", response_model=schemas.User)
def read_users_me(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = get_current_user_from_token(token, db)
    return mark_user_online(db, current_user)


@router.post("/heartbeat")
def heartbeat(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = get_current_user_from_token(token, db)
    mark_user_online(db, current_user)
    return {"status": "online", "last_seen_at": current_user.last_seen_at}


@router.get("/online-count")
def get_online_users_count(
    seconds: int = 90,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    mark_user_online(db, current_user)

    window_seconds = max(30, min(seconds, 600))
    threshold = datetime.utcnow() - timedelta(seconds=window_seconds)
    online_count = db.query(models.User).filter(models.User.last_seen_at >= threshold).count()
    return {"online_users": online_count, "window_seconds": window_seconds}


@router.put("/me/avatar", response_model=schemas.User)
def update_current_user_avatar(
    avatar_update: schemas.UserAvatarUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = get_current_user_from_token(token, db)

    if avatar_update.avatar_data:
        if not str(avatar_update.avatar_data).startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Некорректный формат изображения")
        if len(avatar_update.avatar_data) > 2_500_000:
            raise HTTPException(status_code=400, detail="Изображение слишком большое")

    current_user.avatar_data = avatar_update.avatar_data
    current_user.avatar_type = avatar_update.avatar_type

    db.commit()
    db.refresh(current_user)

    safe_log_user_action(
        db,
        current_user.id,
        "UPDATE_AVATAR",
        "Пользователь обновил аватар",
    )

    return current_user


@router.delete("/me/avatar", response_model=schemas.User)
def delete_current_user_avatar(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = get_current_user_from_token(token, db)
    current_user.avatar_data = None
    current_user.avatar_type = None

    db.commit()
    db.refresh(current_user)

    safe_log_user_action(
        db,
        current_user.id,
        "DELETE_AVATAR",
        "Пользователь удалил аватар",
    )

    return current_user


@router.put("/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = get_current_user_from_token(token, db)

    if user_update.email is not None:
        normalized_email = normalize_email(user_update.email)
        if normalized_email != current_user.email:
            existing_user = (
                db.query(models.User)
                .filter(models.User.email == normalized_email, models.User.id != current_user.id)
                .first()
            )
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already registered")
            current_user.email = normalized_email

    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name

    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name

    if user_update.phone is not None:
        current_user.phone = user_update.phone

    fields_set = getattr(user_update, "model_fields_set", getattr(user_update, "__fields_set__", set()))
    if "avatar_data" in fields_set or "avatar_type" in fields_set:
        if user_update.avatar_data:
            if not str(user_update.avatar_data).startswith("data:image/"):
                raise HTTPException(status_code=400, detail="Некорректный формат изображения")
            if len(user_update.avatar_data) > 2_500_000:
                raise HTTPException(status_code=400, detail="Изображение слишком большое")
            current_user.avatar_data = user_update.avatar_data
            current_user.avatar_type = user_update.avatar_type
        else:
            current_user.avatar_data = None
            current_user.avatar_type = None

    if user_update.password:
        current_user.password_hash = get_password_hash(user_update.password)

    db.commit()
    db.refresh(current_user)

    safe_log_user_action(
        db,
        current_user.id,
        "UPDATE_PROFILE",
        "Пользователь обновил профиль",
    )

    return current_user


# =========================
# PASSWORD RESET
# =========================

@router.post("/forgot-password")
@router.post("/reset-password/request")
def request_password_reset(
    request: schemas.PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    normalized_email = normalize_email(request.email)

    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    # Не раскрываем, существует ли пользователь
    if not user:
        return {"message": "Если email существует, код сброса был отправлен"}

    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email не подтвержден")

    reset_code = generate_reset_code(6)
    reset_codes[normalized_email] = {
        "code": reset_code,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
    }

    print(f"RESET CODE for {normalized_email}: {reset_code}")

    background_tasks.add_task(send_reset_password_email, normalized_email, reset_code)

    return {"message": "Код сброса пароля отправлен на ваш email"}


@router.post("/reset-password")
@router.post("/reset-password/confirm")
def reset_password_confirm(
    request: schemas.PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    if request.email not in reset_codes:
        raise HTTPException(
            status_code=400,
            detail="Код сброса не найден. Запросите новый код.",
        )

    stored_code = reset_codes[request.email]

    if stored_code["code"] != request.code:
        raise HTTPException(status_code=400, detail="Неверный код сброса")

    if stored_code["expires_at"] < datetime.utcnow():
        del reset_codes[request.email]
        raise HTTPException(
            status_code=400,
            detail="Код сброса истек. Запросите новый код.",
        )

    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.password_hash = get_password_hash(request.new_password)
    db.commit()

    del reset_codes[request.email]

    safe_log_user_action(
        db,
        user.id,
        "PASSWORD_RESET",
        "Сброс пароля",
    )

    return {"message": "Пароль успешно изменен"}


# =========================
# ADMIN STATS / LOGS / EXPORT
# =========================

@router.get("/logs")
def get_user_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    require_admin(token, db)

    query = db.query(models.UserLog)

    if user_id is not None:
        query = query.filter(models.UserLog.user_id == user_id)

    if action is not None:
        query = query.filter(models.UserLog.action == action)

    logs = (
        query.order_by(models.UserLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return logs


@router.get("/stats", response_model=schemas.UserStatsResponse)
def get_user_stats(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    require_admin(token, db)

    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified.is_(True)).count()

    total_tours = db.query(models.Tour).count()

    total_bookings = db.query(models.Booking).count()
    pending_bookings = db.query(models.Booking).filter(models.Booking.status == "pending").count()
    confirmed_bookings = db.query(models.Booking).filter(models.Booking.status == "confirmed").count()

    total_reviews = db.query(models.Review).count()
    avg_rating = db.query(func.avg(models.Review.rating)).scalar()

    return {
        "users": {
            "total": total_users,
            "verified": verified_users,
            "unverified": total_users - verified_users,
        },
        "tours": {
            "total": total_tours,
        },
        "bookings": {
            "total": total_bookings,
            "pending": pending_bookings,
            "confirmed": confirmed_bookings,
        },
        "reviews": {
            "total": total_reviews,
            "average_rating": float(avg_rating) if avg_rating else 0,
        },
    }


@router.get("/activity-stats", response_model=schemas.ActivityStatsResponse)
def get_activity_stats(
    days: int = 30,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    require_admin(token, db)

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    registrations = (
        db.query(
            func.date(models.User.created_at).label("date"),
            func.count(models.User.id).label("count"),
        )
        .filter(models.User.created_at >= start_date)
        .group_by(func.date(models.User.created_at))
        .order_by(func.date(models.User.created_at))
        .all()
    )

    bookings = (
        db.query(
            func.date(models.Booking.booking_date).label("date"),
            func.count(models.Booking.id).label("count"),
        )
        .filter(models.Booking.booking_date >= start_date)
        .group_by(func.date(models.Booking.booking_date))
        .order_by(func.date(models.Booking.booking_date))
        .all()
    )

    return {
        "registrations": [
            {"date": str(item.date), "count": int(item.count)} for item in registrations
        ],
        "bookings": [
            {"date": str(item.date), "count": int(item.count)} for item in bookings
        ],
    }


@router.get("/export/users/csv")
def export_users_csv(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    require_admin(token, db)

    if not EXPORTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Модуль export_utils недоступен")

    users = db.query(models.User).all()
    export_data = format_user_data_for_export(users)
    csv_bytes = export_to_csv(export_data, "users")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"users_export_{timestamp}.csv"

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/users/excel")
def export_users_excel(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    require_admin(token, db)

    if not EXPORTS_AVAILABLE:
        raise HTTPException(status_code=500, detail="Модуль export_utils недоступен")

    users = db.query(models.User).all()
    export_data = format_user_data_for_export(users)
    excel_bytes = export_to_excel(export_data, "Пользователи")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"users_export_{timestamp}.xlsx"

    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# =========================
# ADMIN USERS CRUD
# =========================

@router.get("/", response_model=List[schemas.User])
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return db.query(models.User).offset(skip).limit(min(limit, 300)).all()


@router.post("/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = require_admin(token, db)

    normalized_email = normalize_email(user.email)
    existing_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = models.User(
        email=normalized_email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        password_hash=get_password_hash(user.password),
        role="client",
        is_verified=True,
        verification_code=None,
        verification_code_expires=None,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    safe_log_user_action(
        db,
        current_user.id,
        "CREATE_USER",
        f"Создан пользователь {db_user.email}",
    )

    return db_user


@router.get("/{user_id}", response_model=schemas.User)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = require_admin(token, db)

    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.email is not None:
        normalized_email = normalize_email(user_update.email)
        if normalized_email != db_user.email:
            existing_user = (
                db.query(models.User)
                .filter(models.User.email == normalized_email, models.User.id != user_id)
                .first()
            )
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered by another user",
                )
            db_user.email = normalized_email

    if user_update.first_name is not None:
        db_user.first_name = user_update.first_name

    if user_update.last_name is not None:
        db_user.last_name = user_update.last_name

    if user_update.phone is not None:
        db_user.phone = user_update.phone

    if user_update.password:
        db_user.password_hash = get_password_hash(user_update.password)

    db.commit()
    db.refresh(db_user)

    safe_log_user_action(
        db,
        current_user.id,
        "UPDATE_USER",
        f"Обновлен пользователь {db_user.email}",
    )

    return db_user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = require_admin(token, db)

    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    if db_user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete other admins")

    deleted_email = db_user.email
    db.delete(db_user)
    db.commit()

    safe_log_user_action(
        db,
        current_user.id,
        "DELETE_USER",
        f"Удален пользователь {deleted_email}",
    )

    return {"message": "User deleted successfully"}


@router.patch("/{user_id}/role", response_model=schemas.User)
def change_user_role(
    user_id: int,
    role_data: schemas.UserRoleUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = require_admin(token, db)

    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    allowed_roles = ["admin", "manager", "analyst", "client"]
    if role_data.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Недопустимая роль")

    db_user.role = role_data.role
    db.commit()
    db.refresh(db_user)

    safe_log_user_action(
        db,
        current_user.id,
        "CHANGE_ROLE",
        f"Изменена роль пользователя {db_user.email} на {role_data.role}",
    )

    return db_user
