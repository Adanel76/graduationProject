from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
from ..auth import get_password_hash, authenticate_user, create_access_token, oauth2_scheme
from datetime import timedelta, datetime
from jose import JWTError, jwt
from ..email_utils import send_verification_email, send_reset_password_email, generate_verification_code, generate_reset_code
from ..logger import log_user_action
import traceback

router = APIRouter(prefix="/users", tags=["users"])

# Хранилище для кодов подтверждения (временно, в production используй Redis)
verification_codes = {}
reset_codes = {}

def get_client_ip(request: Request):
    """Получение IP адреса клиента"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host

# Эндпоинт для начала регистрации (только отправка кода)
@router.post("/register/start")
def start_registration(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Проверяем, существует ли уже пользователь с таким email
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Генерируем код подтверждения
    verification_code = generate_verification_code(6)
    verification_expires = datetime.utcnow() + timedelta(hours=24)
    
    # Сохраняем код временно (в production используй Redis)
    verification_codes[user.email] = {
        "code": verification_code,
        "expires_at": verification_expires,
        "user_data": {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "password": user.password  # Будет хэширован позже
        }
    }
    
    print(f"Сгенерирован код подтверждения для {user.email}: {verification_code}")  # Для отладки
    
    # Отправляем email с кодом подтверждения
    try:
        send_verification_email(user.email, verification_code)
        return {"message": "Код подтверждения отправлен на ваш email"}
    except Exception as e:
        print(f"Ошибка отправки email подтверждения: {e}")
        # Удаляем код при ошибке отправки
        if user.email in verification_codes:
            del verification_codes[user.email]
        raise HTTPException(status_code=500, detail="Не удалось отправить email подтверждения")

# Эндпоинт для повторной отправки кода подтверждения
@router.post("/register/resend-code")
def resend_verification_code(email: str, db: Session = Depends(get_db)):
    # Проверяем, есть ли данные для этого email
    if email not in verification_codes:
        raise HTTPException(status_code=400, detail="Данные регистрации не найдены. Начните регистрацию заново.")
    
    stored_data = verification_codes[email]
    
    # Проверяем срок действия
    if stored_data["expires_at"] and stored_data["expires_at"] < datetime.utcnow():
        del verification_codes[email]
        raise HTTPException(status_code=400, detail="Срок регистрации истек. Начните регистрацию заново.")
    
    # Генерируем новый код
    new_code = generate_verification_code(6)
    stored_data["code"] = new_code
    stored_data["expires_at"] = datetime.utcnow() + timedelta(hours=24)
    
    # Отправляем email с новым кодом
    try:
        send_verification_email(email, new_code)
        return {"message": "Новый код подтверждения отправлен на ваш email"}
    except Exception as e:
        print(f"Ошибка повторной отправки email: {e}")
        raise HTTPException(status_code=500, detail="Не удалось отправить email подтверждения")

# Эндпоинт для завершения регистрации (после подтверждения кода)
@router.post("/register/complete")
def complete_registration(request: schemas.EmailVerificationRequest, db: Session = Depends(get_db)):
    try:
        email = request.email
        code = request.code
        
        print(f"Попытка завершения регистрации для {email} с кодом {code}")  # Для отладки
        print(f"Сохраненные коды: {verification_codes}")  # Для отладки
        
        # Проверяем, есть ли код для этого email
        if email not in verification_codes:
            raise HTTPException(status_code=400, detail="Код подтверждения не найден. Начните регистрацию заново.")
        
        stored_code = verification_codes[email]
        
        # Проверяем код
        if stored_code["code"] != code:
            raise HTTPException(status_code=400, detail="Неверный код подтверждения")
        
        # Проверяем срок действия кода
        if stored_code["expires_at"] and stored_code["expires_at"] < datetime.utcnow():
            del verification_codes[email]
            raise HTTPException(status_code=400, detail="Код подтверждения истек. Начните регистрацию заново.")
        
        # Получаем данные пользователя
        user_data = stored_code["user_data"]
        
        # Проверяем еще раз, что email не занят
        existing_user = db.query(models.User).filter(models.User.email == email).first()
        if existing_user:
            del verification_codes[email]
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Создаем пользователя
        hashed_password = get_password_hash(user_data["password"])
        db_user = models.User(
            email=user_data["email"],
            password_hash=hashed_password,
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            phone=user_data["phone"],
            is_verified=True,  # Сразу подтвержден
            verification_code=None,
            verification_code_expires=None
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Удаляем использованный код
        del verification_codes[email]

        try:
            # Отправляем приветственный email
            send_welcome_email(db_user.email, f"{db_user.first_name} {db_user.last_name}")
        except Exception as e:
            print(f"Ошибка отправки приветственного email: {e}")
            # Не прерываем процесс регистрации из-за ошибки email

        
        return {"message": "Регистрация успешно завершена", "user": db_user}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка завершения регистрации: {e}")
        raise HTTPException(status_code=500, detail="Ошибка завершения регистрации")

# Эндпоинт для подтверждения уже существующего email (для старых пользователей)
@router.post("/verify-email")
def verify_email(request: schemas.EmailVerificationRequest, db: Session = Depends(get_db)):
    try:
        # Находим пользователя по email
        user = db.query(models.User).filter(models.User.email == request.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Проверяем, уже ли подтвержден
        if user.is_verified:
            return {"message": "Email уже подтвержден"}
        
        # Проверяем код
        if user.verification_code != request.code:
            raise HTTPException(status_code=400, detail="Неверный код подтверждения")
        
        # Проверяем срок действия кода
        if user.verification_code_expires and user.verification_code_expires < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Код подтверждения истек")
        
        # Подтверждаем email
        user.is_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        db.commit()
        
        return {"message": "Email успешно подтвержден"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка подтверждения email: {e}")
        raise HTTPException(status_code=500, detail="Ошибка подтверждения email")

@router.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db), request: Request = None):
    db_user = authenticate_user(db, user.email, user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Проверяем, подтвержден ли email
    if not db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email не подтвержден. Проверьте почту и подтвердите email.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    # Логируем вход
    if request:
        ip_address = get_client_ip(request)
        log_user_action(db, db_user.id, "LOGIN", "Успешный вход в систему", ip_address)
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = auth.get_user(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

# Эндпоинт для запроса сброса пароля
@router.post("/reset-password/request")
async def request_password_reset(request: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    try:
        print(f"Запрос сброса пароля для email: {request.email}")
        
        # Проверяем, существует ли пользователь с таким email
        user = db.query(models.User).filter(models.User.email == request.email).first()
        if not user:
            print(f"Пользователь с email {request.email} не найден")
            return {"message": "Если email существует, код сброса был отправлен"}
        
        # Проверяем, подтвержден ли email
        if not user.is_verified:
            raise HTTPException(status_code=400, detail="Email не подтвержден")
        
        # Генерируем случайный 6-значный код
        reset_code = generate_reset_code(6)
        
        # Сохраняем код
        reset_codes[request.email] = {
            "code": reset_code,
            "expires_at": datetime.utcnow() + timedelta(hours=1)  # Код действует 1 час
        }
        
        print(f"Сгенерирован код для {request.email}: {reset_code}")
        
        # Отправляем email с кодом
        send_reset_password_email(request.email, reset_code)
        return {"message": "Код сброса пароля отправлен на ваш email"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка в request_password_reset: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Эндпоинт для подтверждения сброса пароля
@router.post("/reset-password/confirm")
def reset_password_confirm(request: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    try:
        print(f"Подтверждение сброса пароля для email: {request.email}")
        print(f"Введенный код: {request.code}")
        print(f"Сохраненные коды: {reset_codes}")
        
        # Проверяем код
        if request.email not in reset_codes:
            raise HTTPException(status_code=400, detail="Код сброса не найден. Запросите новый код.")
        
        stored_code = reset_codes[request.email]
        if stored_code["code"] != request.code:
            raise HTTPException(status_code=400, detail="Неверный код сброса")
        
        # Проверяем срок действия кода
        if stored_code["expires_at"] and stored_code["expires_at"] < datetime.utcnow():
            del reset_codes[request.email]
            raise HTTPException(status_code=400, detail="Код сброса истек. Запросите новый код.")
        
        # Находим пользователя
        user = db.query(models.User).filter(models.User.email == request.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Хэшируем новый пароль
        hashed_password = get_password_hash(request.new_password)
        user.password_hash = hashed_password
        
        # Сохраняем изменения
        db.commit()
        
        # Удаляем использованный код
        del reset_codes[request.email]
        
        # Логируем сброс пароля
        log_user_action(db, user.id, "PASSWORD_RESET", "Сброс пароля")
        
        return {"message": "Пароль успешно изменен"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка в reset_password_confirm: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

# Добавим в конец файла:

# Эндпоинт для получения логов пользователя (для админов)
@router.get("/logs")
def get_user_logs(
    skip: int = 0, 
    limit: int = 100, 
    user_id: int = None,
    action: str = None,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Проверяем, что пользователь админ
    current_user = get_current_user_from_token(token, db)
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Строим запрос
    query = db.query(models.UserLog)
    
    # Фильтры
    if user_id:
        query = query.filter(models.UserLog.user_id == user_id)
    if action:
        query = query.filter(models.UserLog.action == action)
    
    # Получаем логи
    logs = query.order_by(models.UserLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return logs

# Эндпоинт для получения статистики
@router.get("/stats")
def get_user_stats(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Проверяем, что пользователь админ
    current_user = get_current_user_from_token(token, db)
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Статистика по пользователям
    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified == True).count()
    
    # Статистика по турам
    total_tours = db.query(models.Tour).count()
    
    # Статистика по бронированиям
    total_bookings = db.query(models.Booking).count()
    pending_bookings = db.query(models.Booking).filter(models.Booking.status == 'pending').count()
    confirmed_bookings = db.query(models.Booking).filter(models.Booking.status == 'confirmed').count()
    
    # Статистика по отзывам
    total_reviews = db.query(models.Review).count()
    avg_rating = db.query(func.avg(models.Review.rating)).scalar()
    
    return {
        "users": {
            "total": total_users,
            "verified": verified_users,
            "unverified": total_users - verified_users
        },
        "tours": {
            "total": total_tours
        },
        "bookings": {
            "total": total_bookings,
            "pending": pending_bookings,
            "confirmed": confirmed_bookings
        },
        "reviews": {
            "total": total_reviews,
            "average_rating": float(avg_rating) if avg_rating else 0
        }
    }

# Эндпоинт для получения активности по дням (для графиков)
@router.get("/activity-stats")
def get_activity_stats(days: int = 30, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Проверяем, что пользователь админ
    current_user = get_current_user_from_token(token, db)
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Получаем активность за последние N дней
    from datetime import datetime, timedelta
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Активность регистраций
    registrations = db.query(
        func.date(models.User.created_at).label('date'),
        func.count(models.User.id).label('count')
    ).filter(
        models.User.created_at >= start_date
    ).group_by(
        func.date(models.User.created_at)
    ).order_by(
        func.date(models.User.created_at)
    ).all()
    
    # Активность бронирований
    bookings = db.query(
        func.date(models.Booking.booking_date).label('date'),
        func.count(models.Booking.id).label('count')
    ).filter(
        models.Booking.booking_date >= start_date
    ).group_by(
        func.date(models.Booking.booking_date)
    ).order_by(
        func.date(models.Booking.booking_date)
    ).all()
    
    return {
        "registrations": [{"date": str(r.date), "count": r.count} for r in registrations],
        "bookings": [{"date": str(b.date), "count": b.count} for b in bookings]
    }

# Добавим в конец файла:

from fastapi.responses import StreamingResponse
from ..export_utils import (
    export_to_csv, export_to_excel,
    format_user_data_for_export,
    format_tour_data_for_export,
    format_booking_data_for_export,
    format_review_data_for_export
)

# Эндпоинт для экспорта пользователей в CSV
@router.get("/export/users/csv")
def export_users_csv(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Проверяем, что пользователь админ
    current_user = get_current_user_from_token(token, db)
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Получаем всех пользователей
    users = db.query(models.User).all()
    
    # Форматируем данные
    export_data = format_user_data_for_export(users)
    
    # Экспортируем в CSV
    csv_bytes = export_to_csv(export_data, "users")
    
    # Возвращаем файл
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"users_export_{timestamp}.csv"
    
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

    # Эндпоинт для экспорта пользователей в Excel
@router.get("/export/users/excel")
def export_users_excel(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Проверяем, что пользователь админ
    current_user = get_current_user_from_token(token, db)
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Получаем всех пользователей
    users = db.query(models.User).all()
    
    # Форматируем данные
    export_data = format_user_data_for_export(users)
    
    # Экспортируем в Excel
    excel_bytes = export_to_excel(export_data, "Пользователи")
    
    # Возвращаем файл
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"users_export_{timestamp}.xlsx"
    
    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )