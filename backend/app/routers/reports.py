from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import auth, models
from ..database import get_db
from ..export_utils import (
    export_to_csv,
    export_to_excel,
    format_booking_data_for_export,
    format_review_data_for_export,
    format_tour_data_for_export,
    format_user_data_for_export,
)

router = APIRouter(prefix="/reports", tags=["reports"])

ALLOWED_EXPORT_ROLES = {"admin", "manager"}


def _require_reports_access(token: str, db: Session):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ALLOWED_EXPORT_ROLES:
        raise HTTPException(status_code=403, detail="Недостаточно прав для экспорта")
    return current_user


def _stream_bytes(payload: bytes, filename: str, media_type: str):
    return StreamingResponse(
        iter([payload]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Дата должна быть в формате YYYY-MM-DD")


def _dataset_rows(
    dataset: str,
    db: Session,
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    tour_id: Optional[int] = None,
    role: Optional[str] = None,
):
    start = _parse_date(date_from)
    end = _parse_date(date_to)

    if dataset == "users":
        query = db.query(models.User)
        if role:
            query = query.filter(models.User.role == role)
        if start:
            query = query.filter(models.User.created_at >= datetime.combine(start, datetime.min.time()))
        if end:
            query = query.filter(models.User.created_at <= datetime.combine(end, datetime.max.time()))
        return format_user_data_for_export(query.order_by(models.User.id.desc()).all())

    if dataset == "tours":
        query = db.query(models.Tour)
        if country:
            query = query.filter(models.Tour.country == country)
        if city:
            query = query.filter(models.Tour.city == city)
        if tour_id:
            query = query.filter(models.Tour.id == tour_id)
        if start:
            query = query.filter(models.Tour.start_date >= start)
        if end:
            query = query.filter(models.Tour.start_date <= end)
        return format_tour_data_for_export(query.order_by(models.Tour.start_date.desc()).all())

    if dataset == "bookings":
        query = db.query(models.Booking).join(models.Tour, models.Booking.tour_id == models.Tour.id, isouter=True)
        if status:
            query = query.filter(models.Booking.status == status)
        if tour_id:
            query = query.filter(models.Booking.tour_id == tour_id)
        if country:
            query = query.filter(models.Tour.country == country)
        if city:
            query = query.filter(models.Tour.city == city)
        if start:
            query = query.filter(models.Booking.booking_date >= datetime.combine(start, datetime.min.time()))
        if end:
            query = query.filter(models.Booking.booking_date <= datetime.combine(end, datetime.max.time()))
        return format_booking_data_for_export(query.order_by(models.Booking.booking_date.desc()).all(), db)

    if dataset == "reviews":
        query = db.query(models.Review).join(models.Tour, models.Review.tour_id == models.Tour.id, isouter=True)
        if tour_id:
            query = query.filter(models.Review.tour_id == tour_id)
        if country:
            query = query.filter(models.Tour.country == country)
        if city:
            query = query.filter(models.Tour.city == city)
        if start:
            query = query.filter(models.Review.created_at >= datetime.combine(start, datetime.min.time()))
        if end:
            query = query.filter(models.Review.created_at <= datetime.combine(end, datetime.max.time()))
        return format_review_data_for_export(query.order_by(models.Review.created_at.desc()).all(), db)

    raise HTTPException(status_code=404, detail="Неизвестный набор данных")


def _export_dataset(dataset: str, file_format: str, db: Session, **filters):
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    rows = _dataset_rows(dataset, db, **filters)

    if file_format == "csv":
        payload = export_to_csv(rows, dataset)
        return _stream_bytes(payload, f"{dataset}_report_{timestamp}.csv", "text/csv; charset=utf-8")

    if file_format == "excel":
        sheet_titles = {
            "users": "Пользователи",
            "tours": "Туры",
            "bookings": "Бронирования",
            "reviews": "Отзывы",
        }
        payload = export_to_excel(rows, sheet_titles.get(dataset, "Отчёт"))
        return _stream_bytes(
            payload,
            f"{dataset}_report_{timestamp}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    raise HTTPException(status_code=404, detail="Неизвестный формат отчёта")


@router.get("/{dataset}/csv")
def export_dataset_csv(
    dataset: str,
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    tour_id: Optional[int] = Query(default=None),
    role: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    _require_reports_access(token, db)
    return _export_dataset(
        dataset,
        "csv",
        db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        country=country,
        city=city,
        tour_id=tour_id,
        role=role,
    )


@router.get("/{dataset}/excel")
def export_dataset_excel(
    dataset: str,
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    tour_id: Optional[int] = Query(default=None),
    role: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    _require_reports_access(token, db)
    return _export_dataset(
        dataset,
        "excel",
        db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        country=country,
        city=city,
        tour_id=tour_id,
        role=role,
    )
