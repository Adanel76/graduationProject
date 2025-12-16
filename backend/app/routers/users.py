from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

from .. import models, schemas, auth, email_utils
from ..database import get_db

load_dotenv()

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Проверяем, существует ли пользователь с таким email
    db_user = auth.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Хэшируем пароль
    hashed_password = auth.get_password_hash(user.password)
    
    # Создаем нового пользователя
    db_user = models.User(
        email=user.email,
        password_hash=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Отправляем приветственное письмо
    try:
        email_utils.send_welcome_email(user.email, f"{user.first_name} {user.last_name}")
    except Exception as e:
        print(f"Ошибка отправки приветственного email: {e}")
    
    return db_user

@router.post("/login", response_model=schemas.Token)
def login_user(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except auth.JWTError:
        raise credentials_exception
    user = auth.get_user(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

@router.get("/export/{data_type}/{format_type}")
def export_data(
    data_type: str, 
    format_type: str,
    token: str = Depends(auth.oauth2_scheme), 
    db: Session = Depends(get_db)
):
    # Проверяем права доступа (только админ)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        user = auth.get_user(db, email=email)
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
    except auth.JWTError:
        raise credentials_exception
    
    # Экспортируем данные в зависимости от типа
    if data_type == "users":
        users = db.query(models.User).all()
        formatted_data = auth.format_user_data_for_export(users)
    elif data_type == "tours":
        tours = db.query(models.Tour).all()
        formatted_data = auth.format_tour_data_for_export(tours)
    elif data_type == "bookings":
        bookings = db.query(models.Booking).all()
        formatted_data = auth.format_booking_data_for_export(bookings, db)
    elif data_type == "reviews":
        reviews = db.query(models.Review).all()
        formatted_data = auth.format_review_data_for_export(reviews, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid data type")
    
    # Форматируем данные для экспорта
    if format_type == "csv":
        content = auth.export_to_csv(formatted_data, f"{data_type}.csv")
        media_type = "text/csv"
        filename = f"{data_type}.csv"
    elif format_type == "excel":
        content = auth.export_to_excel(formatted_data, data_type.capitalize())
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{data_type}.xlsx"
    else:
        raise HTTPException(status_code=400, detail="Invalid format type")
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/stats")
def get_stats(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    # Проверяем права доступа (только админ)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        user = auth.get_user(db, email=email)
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
    except auth.JWTError:
        raise credentials_exception
    
    # Получаем статистику
    users_count = db.query(models.User).count()
    verified_users_count = db.query(models.User).filter(models.User.is_verified == True).count()
    tours_count = db.query(models.Tour).count()
    bookings_count = db.query(models.Booking).count()
    confirmed_bookings_count = db.query(models.Booking).filter(models.Booking.status == "confirmed").count()
    reviews_count = db.query(models.Review).count()
    
    # Средний рейтинг
    avg_rating = db.query(func.avg(models.Review.rating)).scalar()
    if avg_rating is None:
        avg_rating = 0
    else:
        avg_rating = float(avg_rating)
    
    return {
        "users": {
            "total": users_count,
            "verified": verified_users_count
        },
        "tours": {
            "total": tours_count
        },
        "bookings": {
            "total": bookings_count,
            "confirmed": confirmed_bookings_count
        },
        "reviews": {
            "total": reviews_count,
            "average_rating": avg_rating
        }
    }

@router.get("/activity-stats")
def get_activity_stats(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    # Проверяем права доступа (только админ)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        user = auth.get_user(db, email=email)
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
    except auth.JWTError:
        raise credentials_exception
    
    # Получаем статистику активности за последние 30 дней
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Регистрации пользователей
    registrations = db.query(
        func.date(models.User.created_at).label('date'),
        func.count(models.User.id).label('count')
    ).filter(
        models.User.created_at >= thirty_days_ago
    ).group_by(
        func.date(models.User.created_at)
    ).order_by(
        func.date(models.User.created_at)
    ).all()
    
    # Бронирования
    bookings = db.query(
        func.date(models.Booking.booking_date).label('date'),
        func.count(models.Booking.id).label('count')
    ).filter(
        models.Booking.booking_date >= thirty_days_ago
    ).group_by(
        func.date(models.Booking.booking_date)
    ).order_by(
        func.date(models.Booking.booking_date)
    ).all()
    
    # Преобразуем в нужный формат
    registration_stats = []
    booking_stats = []
    
    # Заполняем промежуточные даты нулями
    current_date = thirty_days_ago.date()
    end_date = datetime.utcnow().date()
    
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        
        # Находим регистрацию для этой даты
        reg_count = next((r.count for r in registrations if str(r.date) == date_str), 0)
        registration_stats.append({
            "date": date_str,
            "count": reg_count
        })
        
        # Находим бронирование для этой даты
        book_count = next((b.count for b in bookings if str(b.date) == date_str), 0)
        booking_stats.append({
            "date": date_str,
            "count": book_count
        })
        
        current_date += timedelta(days=1)
    
    return {
        "registrations": registration_stats,
        "bookings": booking_stats
    }
