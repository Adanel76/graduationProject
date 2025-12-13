import csv
import io
from typing import List, Dict, Any
import pandas as pd
from datetime import datetime

def export_to_csv(data: List[Dict[str, Any]], filename: str) -> bytes:
    """Экспорт данных в CSV формат"""
    if not data:
        return b""
    
    # Создаем буфер в памяти
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    
    # Записываем заголовки
    writer.writeheader()
    
    # Записываем данные
    for row in data:
        writer.writerow(row)
    
    # Получаем CSV как строку и конвертируем в байты
    csv_string = output.getvalue()
    output.close()
    
    return csv_string.encode('utf-8')

def export_to_excel(data: List[Dict[str, Any]], sheet_name: str = "Report") -> bytes:
    """Экспорт данных в Excel формат"""
    if not data:
        return b""
    
    # Создаем DataFrame
    df = pd.DataFrame(data)
    
    # Создаем буфер в памяти
    output = io.BytesIO()
    
    # Записываем в Excel
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    # Получаем байты
    excel_bytes = output.getvalue()
    output.close()
    
    return excel_bytes

def format_user_data_for_export(users: List[Any]) -> List[Dict[str, Any]]:
    """Форматирование данных пользователей для экспорта"""
    export_data = []
    for user in users:
        export_data.append({
            'ID': user.id,
            'Email': user.email,
            'Имя': user.first_name,
            'Фамилия': user.last_name,
            'Телефон': user.phone,
            'Роль': user.role,
            'Подтвержден': 'Да' if user.is_verified else 'Нет',
            'Дата регистрации': user.created_at.strftime('%d.%m.%Y %H:%M') if user.created_at else ''
        })
    return export_data

def format_tour_data_for_export(tours: List[Any]) -> List[Dict[str, Any]]:
    """Форматирование данных туров для экспорта"""
    export_data = []
    for tour in tours:
        export_data.append({
            'ID': tour.id,
            'Название': tour.title,
            'Описание': tour.description[:100] + '...' if len(tour.description) > 100 else tour.description,
            'Цена': f"{tour.price:.2f} ₽",
            'Длительность': f"{tour.duration} дней",
            'Дата начала': tour.start_date.strftime('%d.%m.%Y') if tour.start_date else '',
            'Дата окончания': tour.end_date.strftime('%d.%m.%Y') if tour.end_date else '',
            'Страна': tour.country,
            'Город': tour.city,
            'Максимум человек': tour.max_people,
            'Дата создания': tour.created_at.strftime('%d.%m.%Y %H:%M') if tour.created_at else ''
        })
    return export_data

def format_booking_data_for_export(bookings: List[Any], db) -> List[Dict[str, Any]]:
    """Форматирование данных бронирований для экспорта"""
    from . import models
    
    export_data = []
    for booking in bookings:
        # Получаем информацию о пользователе
        user = db.query(models.User).filter(models.User.id == booking.user_id).first()
        # Получаем информацию о туре
        tour = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
        
        export_data.append({
            'ID': booking.id,
            'Пользователь': f"{user.first_name} {user.last_name}" if user else f"ID: {booking.user_id}",
            'Email пользователя': user.email if user else '',
            'Тур': tour.title if tour else f"ID: {booking.tour_id}",
            'Дата бронирования': booking.booking_date.strftime('%d.%m.%Y %H:%M') if booking.booking_date else '',
            'Количество человек': booking.people_count,
            'Статус': booking.status,
            'Цена': f"{tour.price * booking.people_count:.2f} ₽" if tour else ''
        })
    return export_data

def format_review_data_for_export(reviews: List[Any], db) -> List[Dict[str, Any]]:
    """Форматирование данных отзывов для экспорта"""
    from . import models
    
    export_data = []
    for review in reviews:
        # Получаем информацию о пользователе
        user = db.query(models.User).filter(models.User.id == review.user_id).first()
        # Получаем информацию о туре
        tour = db.query(models.Tour).filter(models.Tour.id == review.tour_id).first()
        
        export_data.append({
            'ID': review.id,
            'Пользователь': f"{user.first_name} {user.last_name}" if user else f"ID: {review.user_id}",
            'Email пользователя': user.email if user else '',
            'Тур': tour.title if tour else f"ID: {review.tour_id}",
            'Рейтинг': f"{review.rating} звезд",
            'Комментарий': review.comment if review.comment else '',
            'Дата': review.created_at.strftime('%d.%m.%Y %H:%M') if review.created_at else ''
        })
    return export_data
