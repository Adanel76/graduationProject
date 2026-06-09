import csv
import io
from typing import Any, Dict, Iterable, List

import pandas as pd


def export_to_csv(data: List[Dict[str, Any]], filename: str | None = None) -> bytes:
    if not data:
        return b""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
    writer.writeheader()
    writer.writerows(data)
    return output.getvalue().encode("utf-8-sig")


def export_to_excel(data: List[Dict[str, Any]], sheet_name: str = "Report") -> bytes:
    df = pd.DataFrame(data or [])
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)
    return output.getvalue()


def _dt(value) -> str:
    if not value:
        return ""
    return value.strftime("%d.%m.%Y %H:%M")


def _d(value) -> str:
    if not value:
        return ""
    return value.strftime("%d.%m.%Y")


def format_user_data_for_export(users: Iterable[Any]) -> List[Dict[str, Any]]:
    return [
        {
            "ID": user.id,
            "Email": user.email,
            "Имя": user.first_name or "",
            "Фамилия": user.last_name or "",
            "Телефон": user.phone or "",
            "Роль": user.role,
            "Подтвержден": "Да" if user.is_verified else "Нет",
            "Дата регистрации": _dt(user.created_at),
        }
        for user in users
    ]


def format_tour_data_for_export(tours: Iterable[Any]) -> List[Dict[str, Any]]:
    rows = []
    for tour in tours:
        description = (tour.description or "")
        rows.append(
            {
                "ID": tour.id,
                "Название": tour.title,
                "Описание": description[:100] + "..." if len(description) > 100 else description,
                "Цена": f"{float(tour.price or 0):.2f} ₽",
                "Длительность": f"{tour.duration} дней",
                "Дата начала": _d(tour.start_date),
                "Дата окончания": _d(tour.end_date),
                "Страна": tour.country,
                "Город": tour.city,
                "Максимум человек": tour.max_people,
                "Дата создания": _dt(tour.created_at),
            }
        )
    return rows


def format_booking_data_for_export(bookings: Iterable[Any], db) -> List[Dict[str, Any]]:
    from . import models

    rows = []
    for booking in bookings:
        user = db.query(models.User).filter(models.User.id == booking.user_id).first()
        tour = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
        rows.append(
            {
                "ID": booking.id,
                "Пользователь": ((f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}").strip() or getattr(user, 'email', '') or f"ID: {booking.user_id}"),
                "Email пользователя": getattr(user, 'email', ''),
                "Тур": getattr(tour, 'title', f"ID: {booking.tour_id}"),
                "Дата бронирования": _dt(booking.booking_date),
                "Количество человек": booking.people_count,
                "Статус": booking.status,
                "Цена": f"{float(booking.total_price or 0):.2f} ₽",
            }
        )
    return rows


def format_review_data_for_export(reviews: Iterable[Any], db) -> List[Dict[str, Any]]:
    from . import models

    rows = []
    for review in reviews:
        user = db.query(models.User).filter(models.User.id == review.user_id).first()
        tour = db.query(models.Tour).filter(models.Tour.id == review.tour_id).first()
        rows.append(
            {
                "ID": review.id,
                "Пользователь": ((f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}").strip() or getattr(user, 'email', '') or f"ID: {review.user_id}"),
                "Email пользователя": getattr(user, 'email', ''),
                "Тур": getattr(tour, 'title', f"ID: {review.tour_id}"),
                "Рейтинг": review.rating,
                "Комментарий": review.comment or "",
                "Дата": _dt(review.created_at),
            }
        )
    return rows
