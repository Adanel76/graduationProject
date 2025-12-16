from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
from dotenv import load_dotenv

from .. import models, schemas, email_utils
from ..database import get_db
from ..auth import oauth2_scheme, get_user

load_dotenv()

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.post("/", response_model=schemas.Booking)
def create_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверяем, существует ли тур
    tour = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Проверяем, что количество человек не превышает максимум
    if booking.people_count > tour.max_people:
        raise HTTPException(status_code=400, detail="Not enough places available")
    
    # Создаем бронирование
    db_booking = models.Booking(
        user_id=user.id,
        tour_id=booking.tour_id,
        people_count=booking.people_count
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    
    # Отправляем email подтверждения
    try:
        booking_data = {
            'user_name': f"{user.first_name} {user.last_name}",
            'tour_title': tour.title,
            'tour_location': f"{tour.city}, {tour.country}",
            'tour_dates': f"{tour.start_date} - {tour.end_date}",
            'tour_duration': f"{tour.duration} дней",
            'booking_id': db_booking.id,
            'booking_date': db_booking.booking_date.strftime('%d.%m.%Y %H:%M'),
            'people_count': booking.people_count,
            'final_price': f"{tour.price * booking.people_count:.2f} ₽"
        }
        email_utils.send_booking_confirmation_email(user.email, booking_data)
    except Exception as e:
        print(f"Ошибка отправки email подтверждения: {e}")
    
    return db_booking

@router.get("/", response_model=List[schemas.Booking])
def read_bookings(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Если пользователь админ, возвращаем все бронирования
    if user.role == "admin":
        bookings = db.query(models.Booking).all()
    else:
        # Иначе возвращаем только бронирования пользователя
        bookings = db.query(models.Booking).filter(models.Booking.user_id == user.id).all()
    
    # Добавляем информацию о пользователе и туре
    result = []
    for booking in bookings:
        user_info = db.query(models.User).filter(models.User.id == booking.user_id).first()
        tour_info = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
        
        booking_dict = {
            "id": booking.id,
            "user_id": booking.user_id,
            "tour_id": booking.tour_id,
            "booking_date": booking.booking_date,
            "status": booking.status,
            "people_count": booking.people_count,
            "user_first_name": user_info.first_name if user_info else "",
            "user_last_name": user_info.last_name if user_info else "",
            "tour_title": tour_info.title if tour_info else ""
        }
        result.append(booking_dict)
    
    return result

@router.put("/{booking_id}", response_model=schemas.Booking)
def update_booking(booking_id: int, booking_update: dict, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверяем права доступа
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user.role != "admin" and db_booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Обновляем статус если передан
    if "status" in booking_update:
        old_status = db_booking.status
        db_booking.status = booking_update["status"]
        db.commit()
        db.refresh(db_booking)
        
        # Отправляем email об обновлении статуса
        if old_status != db_booking.status:
            try:
                user_info = db.query(models.User).filter(models.User.id == db_booking.user_id).first()
                tour_info = db.query(models.Tour).filter(models.Tour.id == db_booking.tour_id).first()
                
                if user_info and tour_info:
                    booking_data = {
                        'user_name': f"{user_info.first_name} {user_info.last_name}",
                        'tour_title': tour_info.title,
                        'booking_id': db_booking.id,
                        'booking_date': db_booking.booking_date.strftime('%d.%m.%Y %H:%M'),
                        'status': db_booking.status
                    }
                    email_utils.send_booking_status_update_email(user_info.email, booking_data)
            except Exception as e:
                print(f"Ошибка отправки email обновления статуса: {e}")
    
    return db_booking

@router.delete("/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверяем права доступа
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user.role != "admin" and db_booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db.delete(db_booking)
    db.commit()
    return {"message": "Booking deleted successfully"}
