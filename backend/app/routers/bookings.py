from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import auth, models, schemas
from ..database import get_db
from ..email_utils import (
    send_booking_confirmation_email,
    send_booking_status_update_email,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


ALLOWED_BOOKING_STATUSES = {"pending", "confirmed", "cancelled", "completed"}

BOOKING_STATUS_LABELS = {
    "pending": "Ожидает подтверждения",
    "confirmed": "Подтверждено",
    "cancelled": "Отменено",
    "completed": "Завершено",
}

STAFF_STATUS_TRANSITIONS = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    "cancelled": set(),
    "completed": set(),
}

CLIENT_STATUS_TRANSITIONS = {
    "pending": {"cancelled"},
    "confirmed": set(),
    "cancelled": set(),
    "completed": set(),
}

ACTIVE_SEAT_STATUSES = {"pending", "confirmed", "completed"}



def get_reserved_seats(db: Session, tour_id: int, exclude_booking_id: int | None = None) -> int:
    query = (
        db.query(func.coalesce(func.sum(models.Booking.people_count), 0))
        .filter(models.Booking.tour_id == tour_id)
        .filter(models.Booking.status.in_(list(ACTIVE_SEAT_STATUSES)))
    )

    if exclude_booking_id is not None:
        query = query.filter(models.Booking.id != exclude_booking_id)

    return int(query.scalar() or 0)


def ensure_enough_available_seats(
    db: Session,
    *,
    tour: models.Tour,
    requested_people: int,
    exclude_booking_id: int | None = None,
):
    reserved = get_reserved_seats(db, tour.id, exclude_booking_id=exclude_booking_id)
    available = max(int(tour.max_people or 0) - reserved, 0)

    if requested_people > available:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно свободных мест. Доступно: {available}",
        )

    return available

def to_float(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def calculate_total_price(tour_price, people_count: int, discount_amount=0) -> float:
    base_total = to_float(tour_price) * people_count
    discount = to_float(discount_amount)
    total = base_total - discount
    return round(max(total, 0), 2)


def get_booking_status_by_code(db: Session, code: str):
    return db.query(models.BookingStatus).filter(models.BookingStatus.code == code).first()


def get_effective_booking_status(booking: models.Booking) -> str:
    if booking.status:
        return booking.status

    if getattr(booking, "status_ref", None) and booking.status_ref.code:
        return booking.status_ref.code

    return "pending"


def get_status_label(status_code: str | None) -> str:
    if not status_code:
        return "Неизвестно"

    return BOOKING_STATUS_LABELS.get(status_code, status_code)


def ensure_status_exists(db: Session, status_code: str):
    status_ref = get_booking_status_by_code(db, status_code)

    if not status_ref:
        raise HTTPException(
            status_code=500,
            detail=f"Статус бронирования «{status_code}» отсутствует в справочнике",
        )

    return status_ref


def validate_status_transition(
    *,
    old_status: str,
    new_status: str,
    is_staff: bool,
):
    if new_status not in ALLOWED_BOOKING_STATUSES:
        raise HTTPException(status_code=400, detail="Недопустимый статус бронирования")

    if old_status == new_status:
        return

    transitions = STAFF_STATUS_TRANSITIONS if is_staff else CLIENT_STATUS_TRANSITIONS
    allowed_next_statuses = transitions.get(old_status, set())

    if new_status not in allowed_next_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Недопустимый переход статуса: "
                f"«{get_status_label(old_status)}» → «{get_status_label(new_status)}»"
            ),
        )


def apply_booking_status(
    db: Session,
    booking: models.Booking,
    new_status: str,
):
    status_ref = ensure_status_exists(db, new_status)

    booking.status = new_status
    booking.status_id = status_ref.id


def append_status_history(db: Session, booking: models.Booking, old_status_code: str | None, new_status_code: str | None, changed_by_user_id: int | None, note: str | None = None):
    if old_status_code == new_status_code:
        return

    old_status = get_booking_status_by_code(db, old_status_code) if old_status_code else None
    new_status = get_booking_status_by_code(db, new_status_code) if new_status_code else None

    db.add(
        models.BookingStatusHistory(
            booking_id=booking.id,
            old_status_id=getattr(old_status, "id", None),
            new_status_id=getattr(new_status, "id", None),
            changed_by_user_id=changed_by_user_id,
            note=note,
        )
    )


def serialize_booking(booking: models.Booking) -> schemas.BookingResponse:
    status_value = booking.status
    payment_status_value = booking.payment_status
    payment_method_value = booking.payment_method

    if not status_value and getattr(booking, "status_ref", None):
        status_value = booking.status_ref.code

    if not payment_status_value and getattr(booking, "payment_status_ref", None):
        payment_status_value = booking.payment_status_ref.code

    if not payment_method_value and getattr(booking, "payment_method_ref", None):
        payment_method_value = booking.payment_method_ref.code

    return schemas.BookingResponse(
        id=booking.id,
        user_id=booking.user_id,
        tour_id=booking.tour_id,
        people_count=booking.people_count,
        total_price=to_float(booking.total_price),
        discount_amount=to_float(booking.discount_amount),
        status=status_value,
        payment_status=payment_status_value,
        payment_method=payment_method_value,
        promo_code_id=booking.promo_code_id,
        status_id=booking.status_id,
        payment_status_id=booking.payment_status_id,
        payment_method_id=booking.payment_method_id,
        booking_date=booking.booking_date,
        created_at=booking.booking_date,
        user_email=getattr(getattr(booking, "user", None), "email", None),
        user_phone=getattr(getattr(booking, "user", None), "phone", None),
    )


def build_booking_email_payload(
    booking: models.Booking,
    user: models.User,
    tour: models.Tour,
) -> dict:
    tour_dates = f"{tour.start_date.strftime('%d.%m.%Y')} — {tour.end_date.strftime('%d.%m.%Y')}"
    return {
        "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        "tour_title": tour.title,
        "tour_location": f"{tour.city}, {tour.country}",
        "tour_dates": tour_dates,
        "tour_duration": f"{tour.duration} дн.",
        "booking_id": booking.id,
        "booking_date": booking.booking_date.strftime("%d.%m.%Y %H:%M"),
        "people_count": booking.people_count,
        "final_price": f"{to_float(booking.total_price):,.2f} ₽".replace(",", " "),
        "discount_info": (
            f"{to_float(booking.discount_amount):,.2f} ₽".replace(",", " ")
            if to_float(booking.discount_amount) > 0
            else ""
        ),
        "status": booking.status or "pending",
    }


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "info",
):
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        is_read=False,
        read_at=None,
    )
    db.add(notification)
    return notification


@router.get("/", response_model=List[schemas.BookingResponse])
def get_bookings(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    query = (
        db.query(models.Booking)
        .options(
            joinedload(models.Booking.tour),
            joinedload(models.Booking.user),
            joinedload(models.Booking.status_ref),
            joinedload(models.Booking.payment_status_ref),
            joinedload(models.Booking.payment_method_ref),
        )
        .order_by(models.Booking.booking_date.desc(), models.Booking.id.desc())
    )

    if current_user.role not in ["admin", "manager"]:
        query = query.filter(models.Booking.user_id == current_user.id)

    bookings = query.offset(skip).limit(limit).all()
    return [serialize_booking(item) for item in bookings]


@router.get("/{booking_id}", response_model=schemas.BookingResponse)
def get_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    booking = (
        db.query(models.Booking)
        .options(
            joinedload(models.Booking.tour),
            joinedload(models.Booking.user),
            joinedload(models.Booking.status_ref),
            joinedload(models.Booking.payment_status_ref),
            joinedload(models.Booking.payment_method_ref),
        )
        .filter(models.Booking.id == booking_id)
        .first()
    )

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role not in ["admin", "manager"] and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return serialize_booking(booking)


@router.post("/", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking: schemas.BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if booking.people_count <= 0:
        raise HTTPException(status_code=400, detail="Количество человек должно быть больше 0")

    tour = db.query(models.Tour).filter(models.Tour.id == booking.tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    today = date.today()
    if tour.start_date < today:
        raise HTTPException(status_code=400, detail="Нельзя забронировать тур, дата начала которого уже прошла")

    ensure_enough_available_seats(db, tour=tour, requested_people=booking.people_count)

    total_price = calculate_total_price(tour.price, booking.people_count)

    pending_status = ensure_status_exists(db, "pending")

    db_booking = models.Booking(
        user_id=current_user.id,
        tour_id=booking.tour_id,
        people_count=booking.people_count,
        total_price=total_price,
        discount_amount=0,
        status="pending",
        status_id=pending_status.id,
        payment_status="pending",
        payment_method=None,
    )

    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)

    append_status_history(db, db_booking, None, db_booking.status, current_user.id, "Бронирование создано")
    db.commit()

    create_notification(
        db=db,
        user_id=current_user.id,
        title="Бронирование создано",
        message=f"Ваше бронирование тура «{tour.title}» успешно создано и ожидает подтверждения.",
        notification_type="info",
    )
    db.commit()

    email_payload = build_booking_email_payload(db_booking, current_user, tour)
    background_tasks.add_task(
        send_booking_confirmation_email,
        current_user.email,
        email_payload,
    )

    return serialize_booking(db_booking)


@router.put("/{booking_id}", response_model=schemas.BookingResponse)
def update_booking(
    booking_id: int,
    booking_update: schemas.BookingUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    booking = (
        db.query(models.Booking)
        .options(
            joinedload(models.Booking.tour),
            joinedload(models.Booking.user),
            joinedload(models.Booking.status_ref),
            joinedload(models.Booking.payment_status_ref),
            joinedload(models.Booking.payment_method_ref),
        )
        .filter(models.Booking.id == booking_id)
        .first()
    )

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_staff = current_user.role in ["admin", "manager"]
    is_owner = booking.user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    old_status = get_effective_booking_status(booking)

    # client
    if not is_staff:
        if booking_update.people_count is not None:
            if old_status != "pending":
                raise HTTPException(
                    status_code=400,
                    detail="Изменение количества человек доступно только для ожидающих бронирований",
                )
            if booking_update.people_count <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Количество человек должно быть больше 0",
                )
            ensure_enough_available_seats(
                db,
                tour=booking.tour,
                requested_people=booking_update.people_count,
                exclude_booking_id=booking.id,
            )
            booking.people_count = booking_update.people_count

        if booking_update.status is not None:
            if booking_update.status != "cancelled":
                raise HTTPException(
                    status_code=403,
                    detail="Пользователь может только отменить своё бронирование",
                )

            validate_status_transition(
                old_status=old_status,
                new_status="cancelled",
                is_staff=False,
            )

            apply_booking_status(db, booking, "cancelled")

    # admin / manager
    else:
        if booking_update.people_count is not None:
            if old_status in ["cancelled", "completed"]:
                raise HTTPException(
                    status_code=400,
                    detail="Нельзя изменять количество человек в завершённом или отменённом бронировании",
                )

            if booking_update.people_count <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Количество человек должно быть больше 0",
                )
            ensure_enough_available_seats(
                db,
                tour=booking.tour,
                requested_people=booking_update.people_count,
                exclude_booking_id=booking.id,
            )
            booking.people_count = booking_update.people_count

        if booking_update.status is not None:
            validate_status_transition(
                old_status=old_status,
                new_status=booking_update.status,
                is_staff=True,
            )

            apply_booking_status(db, booking, booking_update.status)

            if booking_update.status in ACTIVE_SEAT_STATUSES:
                ensure_enough_available_seats(
                    db,
                    tour=booking.tour,
                    requested_people=booking.people_count,
                    exclude_booking_id=booking.id,
                )

        if booking_update.payment_status_id is not None:
            payment_status = (
                db.query(models.PaymentStatus)
                .filter(models.PaymentStatus.id == booking_update.payment_status_id)
                .first()
            )
            if not payment_status:
                raise HTTPException(status_code=404, detail="Payment status not found")
            booking.payment_status_id = payment_status.id
            booking.payment_status = payment_status.code

        if booking_update.payment_method_id is not None:
            payment_method = (
                db.query(models.PaymentMethod)
                .filter(models.PaymentMethod.id == booking_update.payment_method_id)
                .first()
            )
            if not payment_method:
                raise HTTPException(status_code=404, detail="Payment method not found")
            booking.payment_method_id = payment_method.id
            booking.payment_method = payment_method.code

    booking.total_price = calculate_total_price(
        booking.tour.price,
        booking.people_count,
        booking.discount_amount,
    )

    db.commit()
    db.refresh(booking)

    if old_status != (booking.status or "pending"):
        append_status_history(db, booking, old_status, booking.status or "pending", current_user.id, getattr(booking_update, "note", None))
        db.commit()
        create_notification(
            db=db,
            user_id=booking.user_id,
            title="Статус бронирования обновлен",
            message=(
                f"Статус бронирования тура «{booking.tour.title}» изменён на "
                f"«{get_status_label(booking.status)}»."
            ),
            notification_type="info" if booking.status != "cancelled" else "warning",
        )
        db.commit()

        email_payload = build_booking_email_payload(booking, booking.user, booking.tour)
        background_tasks.add_task(
            send_booking_status_update_email,
            booking.user.email,
            email_payload,
        )

    return serialize_booking(booking)


@router.patch("/{booking_id}/status", response_model=schemas.BookingResponse)
def patch_booking_status(
    booking_id: int,
    booking_update: schemas.BookingUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    return update_booking(booking_id, booking_update, background_tasks, db, token)


@router.get(
    "/{booking_id}/history",
    response_model=List[schemas.BookingStatusHistoryResponse],
)
def get_booking_status_history(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_staff = current_user.role in ["admin", "manager"]
    is_owner = booking.user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    history_items = (
        db.query(models.BookingStatusHistory)
        .options(
            joinedload(models.BookingStatusHistory.old_status),
            joinedload(models.BookingStatusHistory.new_status),
            joinedload(models.BookingStatusHistory.changed_by_user),
        )
        .filter(models.BookingStatusHistory.booking_id == booking_id)
        .order_by(models.BookingStatusHistory.changed_at.desc())
        .all()
    )

    return [
        schemas.BookingStatusHistoryResponse(
            id=item.id,
            booking_id=item.booking_id,
            old_status=item.old_status.code if item.old_status else None,
            old_status_name=item.old_status.name if item.old_status else None,
            new_status=item.new_status.code if item.new_status else None,
            new_status_name=item.new_status.name if item.new_status else None,
            changed_by_user_id=item.changed_by_user_id,
            changed_by_user_email=(
                item.changed_by_user.email if item.changed_by_user else None
            ),
            note=item.note,
            changed_at=item.changed_at,
        )
        for item in history_items
    ]


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_staff = current_user.role in ["admin", "manager"]
    is_owner = booking.user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if is_owner and booking.status not in ["pending", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить подтвержденное или завершенное бронирование",
        )

    db.delete(booking)
    db.commit()

    return {"message": "Booking deleted successfully"}
