from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth import oauth2_scheme
from ..auth import get_user
from jose import JWTError, jwt
from ..auth import SECRET_KEY, ALGORITHM
from ..email_utils import send_booking_confirmation_email, send_booking_status_update_email
from datetime import datetime

router = APIRouter(prefix="/bookings", tags=["bookings"])

def get_current_user_from_token(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(db, email=email)
    if user is None:
        raise credentials_exception
    return user

@router.post("/", response_model=schemas.Booking)
def create_booking(
    booking: schemas.BookingCreate, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        # Получаем текущего пользователя
        current_user = get_current_user_from_token(token, db)
        
        # Проверяем, существует ли тур
        tour = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")
        
        # Проверяем доступность мест
        if booking.people_count > tour.max_people:
            raise HTTPException(status_code=400, detail=f"Maximum people allowed: {tour.max_people}")
        
        # Создаем бронирование
        db_booking = models.Booking(
            user_id=current_user.id,
            tour_id=booking.tour_id,
            people_count=booking.people_count
        )
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        
        # Отправляем email подтверждения бронирования с полной информацией
        try:
            # Расчет цены со скидкой
            base_price = tour.price
            total_price = base_price * booking.people_count
            
            # Система скидок
            discount = 0
            discount_info = ""
            if booking.people_count >= 7:
                discount = 0.15
                discount_info = "15% (7+ человек)"
            elif booking.people_count >= 4:
                discount = 0.10
                discount_info = "10% (4-6 человек)"
            elif booking.people_count >= 2:
                discount = 0.05
                discount_info = "5% (2-3 человека)"
            
            discount_amount = total_price * discount
            final_price = total_price - discount_amount
            
            # Подготовка данных для email
            booking_data = {
                'user_name': f"{current_user.first_name} {current_user.last_name}",
                'tour_title': tour.title,
                'tour_location': f"{tour.city}, {tour.country}",
                'tour_dates': f"{tour.start_date.strftime('%d.%m.%Y')} - {tour.end_date.strftime('%d.%m.%Y')}",
                'tour_duration': f"{tour.duration} дней",
                'booking_id': db_booking.id,
                'booking_date': db_booking.booking_date.strftime('%d.%m.%Y %H:%M'),
                'people_count': db_booking.people_count,
                'discount_info': discount_info,
                'final_price': f"{final_price:,.2f} ₽".replace(',', ' ')
            }
            
            send_booking_confirmation_email(current_user.email, booking_data)
        except Exception as e:
            print(f"Ошибка отправки email подтверждения бронирования: {e}")
            # Не прерываем основной процесс из-за ошибки email
        
        return db_booking
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка создания бронирования: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания бронирования")

@router.get("/", response_model=List[schemas.Booking])
def read_bookings(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        # Получаем текущего пользователя
        current_user = get_current_user_from_token(token, db)
        
        # Если админ, показываем все бронирования
        if current_user.role == 'admin':
            bookings = db.query(models.Booking).all()
        else:
            # Иначе показываем только свои бронирования
            bookings = db.query(models.Booking).filter(models.Booking.user_id == current_user.id).all()
        
        return bookings
    except Exception as e:
        print(f"Ошибка получения бронирований: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения бронирований")

@router.get("/{booking_id}", response_model=schemas.Booking)
def read_booking(
    booking_id: int, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        # Получаем текущего пользователя
        current_user = get_current_user_from_token(token, db)
        
        # Находим бронирование
        db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
        if db_booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Проверяем права доступа
        if current_user.role != 'admin' and db_booking.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        return db_booking
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка получения бронирования: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения бронирования")

@router.put("/{booking_id}", response_model=schemas.Booking)
def update_booking(
    booking_id: int, 
    booking_update: schemas.BookingCreate, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        # Получаем текущего пользователя
        current_user = get_current_user_from_token(token, db)
        
        # Находим бронирование
        db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
        if db_booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Проверяем права доступа (только админ может изменять бронирования)
        if current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        old_status = db_booking.status
        
        # Обновляем поля
        for key, value in booking_update.dict().items():
            setattr(db_booking, key, value)
        
        db.commit()
        db.refresh(db_booking)
        
        # Отправляем email об обновлении статуса, если статус изменился
        if old_status != db_booking.status:
            try:
                # Получаем данные для email
                user = db.query(models.User).filter(models.User.id == db_booking.user_id).first()
                tour = db.query(models.Tour).filter(models.Tour.id == db_booking.tour_id).first()
                
                if user and tour:
                    booking_data = {
                        'user_name': f"{user.first_name} {user.last_name}",
                        'tour_title': tour.title,
                        'booking_date': db_booking.booking_date.strftime('%d.%m.%Y %H:%M'),
                        'people_count': db_booking.people_count,
                        'status': db_booking.status
                    }
                    send_booking_status_update_email(user.email, booking_data)
            except Exception as e:
                print(f"Ошибка отправки email обновления статуса бронирования: {e}")
        
        return db_booking
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка обновления бронирования: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления бронирования")

@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        # Получаем текущего пользователя
        current_user = get_current_user_from_token(token, db)
        
        # Находим бронирование
        db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
        if db_booking is None:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Проверяем права доступа (только админ может удалять бронирования)
        if current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        db.delete(db_booking)
        db.commit()
        return {"message": "Booking deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка удаления бронирования: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления бронирования")
