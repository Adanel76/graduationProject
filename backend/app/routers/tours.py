from datetime import date
from typing import List, Optional
import base64
import binascii
import csv
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session, defer

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/tours", tags=["tours"])


ACTIVE_SEAT_STATUSES = {"pending", "confirmed", "completed"}


SORT_FIELDS = {
    "created_at": models.Tour.created_at,
    "price": models.Tour.price,
    "duration": models.Tour.duration,
    "start_date": models.Tour.start_date,
    "rating": models.Tour.rating,
    "title": models.Tour.title,
}


CSV_FIELD_ALIASES = {
    "title": ["title", "название", "name", "tour_title"],
    "description": ["description", "описание"],
    "price": ["price", "стоимость", "цена"],
    "duration": ["duration", "длительность", "days", "дни"],
    "start_date": ["start_date", "дата_начала", "начало"],
    "end_date": ["end_date", "дата_окончания", "окончание"],
    "country": ["country", "страна"],
    "city": ["city", "город", "курорт"],
    "max_people": ["max_people", "мест", "количество_мест", "seats"],
    "program": ["program", "программа"],
    "accommodation": ["accommodation", "проживание"],
    "meals": ["meals", "питание"],
    "meals_features": ["meals_features", "особенности_питания"],
    "activities": ["activities", "активности"],
    "activities_features": ["activities_features", "особенности_активностей"],
    "resort_info": ["resort_info", "о_курорте"],
    "resort_features": ["resort_features", "особенности_курорта"],
    "program_details": ["program_details", "подробности_программы"],
    "hotel_name": ["hotel_name", "отель", "название_отеля"],
    "hotel_address": ["hotel_address", "адрес_отеля"],
    "hotel_description": ["hotel_description", "описание_отеля"],
    "hotel_features": ["hotel_features", "характеристики_отеля"],
    "hotel_map_lat": ["hotel_map_lat", "широта_отеля"],
    "hotel_map_lng": ["hotel_map_lng", "долгота_отеля"],
    "hotel_map_zoom": ["hotel_map_zoom", "масштаб_отеля"],
    "map_lat": ["map_lat", "широта"],
    "map_lng": ["map_lng", "долгота"],
    "map_zoom": ["map_zoom", "масштаб"],
    "image_url": ["image_url", "картинка", "изображение"],
}

REQUIRED_CSV_FIELDS = ["title", "price", "duration", "start_date", "end_date", "country", "city", "max_people"]


def normalize_csv_key(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def get_csv_value(row: dict, field: str) -> str:
    normalized_row = {normalize_csv_key(key): value for key, value in row.items()}
    for alias in CSV_FIELD_ALIASES.get(field, [field]):
        key = normalize_csv_key(alias)
        if key in normalized_row:
            return str(normalized_row.get(key) or "").strip()
    return ""


def parse_csv_float(value: str, field_label: str, row_number: int) -> float | None:
    if value == "":
        return None
    try:
        return float(str(value).replace(" ", "").replace(",", "."))
    except ValueError:
        raise ValueError(f"строка {row_number}: поле {field_label} должно быть числом")


def parse_csv_int(value: str, field_label: str, row_number: int) -> int | None:
    number = parse_csv_float(value, field_label, row_number)
    return int(number) if number is not None else None


def parse_csv_date(value: str, field_label: str, row_number: int) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"строка {row_number}: поле {field_label} должно быть датой в формате YYYY-MM-DD")


def build_tour_from_csv_row(row: dict, row_number: int) -> models.Tour:
    values = {field: get_csv_value(row, field) for field in CSV_FIELD_ALIASES}
    missing = [field for field in REQUIRED_CSV_FIELDS if not values.get(field)]
    if missing:
        raise ValueError(f"строка {row_number}: не заполнены обязательные поля: {', '.join(missing)}")

    start = parse_csv_date(values["start_date"], "start_date", row_number)
    end = parse_csv_date(values["end_date"], "end_date", row_number)
    if end < start:
        raise ValueError(f"строка {row_number}: дата окончания раньше даты начала")

    price = parse_csv_float(values["price"], "price", row_number)
    duration = parse_csv_int(values["duration"], "duration", row_number)
    max_people = parse_csv_int(values["max_people"], "max_people", row_number)

    if price is None or price <= 0:
        raise ValueError(f"строка {row_number}: цена должна быть больше 0")
    if duration is None or duration <= 0:
        raise ValueError(f"строка {row_number}: длительность должна быть больше 0")
    if max_people is None or max_people <= 0:
        raise ValueError(f"строка {row_number}: количество мест должно быть больше 0")

    return models.Tour(
        title=values["title"],
        description=values.get("description") or None,
        price=price,
        duration=duration,
        start_date=start,
        end_date=end,
        country=values["country"],
        city=values["city"],
        max_people=max_people,
        program=values.get("program") or None,
        accommodation=values.get("accommodation") or None,
        meals=values.get("meals") or None,
        meals_features=values.get("meals_features") or None,
        activities=values.get("activities") or None,
        activities_features=values.get("activities_features") or None,
        resort_info=values.get("resort_info") or None,
        resort_features=values.get("resort_features") or None,
        program_details=values.get("program_details") or None,
        hotel_name=values.get("hotel_name") or None,
        hotel_address=values.get("hotel_address") or None,
        hotel_description=values.get("hotel_description") or None,
        hotel_features=values.get("hotel_features") or None,
        hotel_map_lat=parse_csv_float(values.get("hotel_map_lat") or "", "hotel_map_lat", row_number),
        hotel_map_lng=parse_csv_float(values.get("hotel_map_lng") or "", "hotel_map_lng", row_number),
        hotel_map_zoom=parse_csv_int(values.get("hotel_map_zoom") or "", "hotel_map_zoom", row_number) or 15,
        map_lat=parse_csv_float(values.get("map_lat") or "", "map_lat", row_number),
        map_lng=parse_csv_float(values.get("map_lng") or "", "map_lng", row_number),
        map_zoom=parse_csv_int(values.get("map_zoom") or "", "map_zoom", row_number) or 12,
        image_url=values.get("image_url") or None,
        rating=0,
        review_count=0,
    )


def decode_image_base64(image_base64: str) -> bytes:
    try:
        return base64.b64decode(image_base64)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image_base64")


def get_reserved_seats(db: Session, tour_id: int) -> int:
    reserved = (
        db.query(func.coalesce(func.sum(models.Booking.people_count), 0))
        .filter(models.Booking.tour_id == tour_id)
        .filter(models.Booking.status.in_(list(ACTIVE_SEAT_STATUSES)))
        .scalar()
    )
    return int(reserved or 0)


def get_tour_capacity(db: Session | None, tour: models.Tour) -> tuple[int, int, bool]:
    reserved = get_reserved_seats(db, tour.id) if db is not None and tour.id else 0
    available = max(int(tour.max_people or 0) - reserved, 0)
    is_archived = bool(tour.start_date and tour.start_date < date.today())
    return reserved, available, is_archived


def serialize_tour_image(image: models.TourImage) -> schemas.TourImageResponse:
    encoded_image = None
    if image.image_data:
        encoded_image = base64.b64encode(image.image_data).decode("utf-8")

    return schemas.TourImageResponse(
        id=image.id,
        tour_id=image.tour_id,
        image_url=image.image_url,
        image_data=encoded_image,
        image_type=image.image_type,
        alt_text=image.alt_text,
        sort_order=image.sort_order or 0,
        created_at=image.created_at,
    )


def serialize_tour(
    tour: models.Tour,
    include_image_data: bool = False,
    include_gallery: bool = False,
    db: Session | None = None,
) -> schemas.TourResponse:
    encoded_image = None
    if include_image_data and tour.image_data:
        encoded_image = base64.b64encode(tour.image_data).decode("utf-8")

    reserved_seats, available_seats, is_archived = get_tour_capacity(db, tour)

    return schemas.TourResponse(
        id=tour.id,
        title=tour.title,
        description=tour.description,
        price=float(tour.price) if tour.price is not None else 0,
        duration=tour.duration,
        start_date=tour.start_date,
        end_date=tour.end_date,
        country=tour.country,
        city=tour.city,
        max_people=tour.max_people,
        program=tour.program,
        accommodation=tour.accommodation,
        meals=tour.meals,
        meals_features=tour.meals_features,
        activities=tour.activities,
        activities_features=tour.activities_features,
        resort_info=tour.resort_info,
        resort_features=tour.resort_features,
        program_details=tour.program_details,
        hotel_name=tour.hotel_name,
        hotel_address=tour.hotel_address,
        hotel_description=tour.hotel_description,
        hotel_features=tour.hotel_features,
        hotel_map_lat=tour.hotel_map_lat,
        hotel_map_lng=tour.hotel_map_lng,
        hotel_map_zoom=tour.hotel_map_zoom or 15,
        map_lat=tour.map_lat,
        map_lng=tour.map_lng,
        map_zoom=tour.map_zoom or 12,
        created_at=tour.created_at,
        image_data=encoded_image,
        image_type=tour.image_type,
        image_url=tour.image_url,
        rating=float(tour.rating) if tour.rating is not None else 0,
        review_count=tour.review_count or 0,
        reserved_seats=reserved_seats,
        available_seats=available_seats,
        is_archived=is_archived,
        country_id=tour.country_id,
        resort_id=tour.resort_id,
        gallery_images=(
            [serialize_tour_image(image) for image in getattr(tour, "gallery_images", [])]
            if include_gallery
            else []
        ),
    )


def apply_tour_filters(
    query,
    *,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    country: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    duration: Optional[int] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    if search:
        search_value = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Tour.title.ilike(search_value),
                models.Tour.description.ilike(search_value),
                models.Tour.country.ilike(search_value),
                models.Tour.city.ilike(search_value),
            )
        )

    if min_price is not None:
        query = query.filter(models.Tour.price >= min_price)

    if max_price is not None:
        query = query.filter(models.Tour.price <= max_price)

    if country:
        query = query.filter(models.Tour.country == country)

    if start_date is not None:
        query = query.filter(models.Tour.start_date >= start_date)

    if end_date is not None:
        query = query.filter(models.Tour.end_date <= end_date)

    if duration is not None:
        query = query.filter(models.Tour.duration == duration)

    sort_column = SORT_FIELDS.get(sort_by, models.Tour.created_at)
    order_expression = asc(sort_column) if sort_order == "asc" else desc(sort_column)

    query = query.order_by(order_expression, desc(models.Tour.id))
    return query


@router.get("/light", response_model=List[schemas.TourResponse])
def read_tours_light(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=500),
    search: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    country: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    duration: Optional[int] = Query(default=None, ge=1),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(models.Tour).options(defer(models.Tour.image_data))

        if not include_archived:
            query = query.filter(models.Tour.start_date >= date.today())

        query = apply_tour_filters(
            query,
            search=search,
            min_price=min_price,
            max_price=max_price,
            country=country,
            start_date=start_date,
            end_date=end_date,
            duration=duration,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        tours = query.offset(skip).limit(limit).all()
        return [serialize_tour(tour, include_image_data=False, db=db) for tour in tours]
    except Exception as e:
        print(f"Ошибка получения облегченного списка туров: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения туров")


@router.get("/", response_model=List[schemas.TourResponse])
def read_tours(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=500),
    include_image_data: bool = Query(default=False),
    include_gallery: bool = Query(default=False),
    search: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    country: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    duration: Optional[int] = Query(default=None, ge=1),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(models.Tour)

        if not include_archived:
            query = query.filter(models.Tour.start_date >= date.today())

        if not include_image_data:
            query = query.options(defer(models.Tour.image_data))

        query = apply_tour_filters(
            query,
            search=search,
            min_price=min_price,
            max_price=max_price,
            country=country,
            start_date=start_date,
            end_date=end_date,
            duration=duration,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        tours = query.offset(skip).limit(limit).all()
        return [
            serialize_tour(
                tour,
                include_image_data=include_image_data,
                include_gallery=include_gallery,
                db=db,
            )
            for tour in tours
        ]
    except Exception as e:
        print(f"Ошибка получения туров: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения туров")


@router.get("/{tour_id}/gallery", response_model=List[schemas.TourImageResponse])
def read_tour_gallery(
    tour_id: int,
    db: Session = Depends(get_db),
):
    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    images = (
        db.query(models.TourImage)
        .filter(models.TourImage.tour_id == tour_id)
        .order_by(models.TourImage.sort_order.asc(), models.TourImage.id.asc())
        .all()
    )
    return [serialize_tour_image(image) for image in images]


@router.put("/{tour_id}/gallery", response_model=List[schemas.TourImageResponse])
def replace_tour_gallery(
    tour_id: int,
    payload: schemas.TourGalleryUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    if len(payload.images) > 8:
        raise HTTPException(status_code=400, detail="Можно добавить не больше 8 изображений")

    try:
        db.query(models.TourImage).filter(models.TourImage.tour_id == tour_id).delete(
            synchronize_session=False
        )

        prepared_images = []
        for index, item in enumerate(payload.images):
            image_url = item.image_url.strip() if item.image_url else None
            image_data = None
            image_type = item.image_type or None

            if item.image_base64:
                image_data = decode_image_base64(item.image_base64)
                image_url = None
                image_type = image_type or "image/jpeg"

            if not image_url and not image_data:
                continue

            prepared_images.append(
                models.TourImage(
                    tour_id=tour_id,
                    image_url=image_url,
                    image_data=image_data,
                    image_type=image_type,
                    alt_text=item.alt_text or tour.title,
                    sort_order=item.sort_order if item.sort_order is not None else index,
                )
            )

        for image in prepared_images:
            db.add(image)

        db.commit()

        images = (
            db.query(models.TourImage)
            .filter(models.TourImage.tour_id == tour_id)
            .order_by(models.TourImage.sort_order.asc(), models.TourImage.id.asc())
            .all()
        )
        return [serialize_tour_image(image) for image in images]
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Ошибка обновления галереи тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления галереи тура")


@router.get("/{tour_id}/image")
def read_tour_image(
    tour_id: int,
    db: Session = Depends(get_db),
):
    try:
        tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()

        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")

        if tour.image_url and tour.image_type == "image/svg+xml":
            response = RedirectResponse(url=tour.image_url, status_code=307)
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            return response

        if tour.image_data:
            return Response(
                content=tour.image_data,
                media_type=tour.image_type or "image/jpeg",
                headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
            )

        if tour.image_url:
            response = RedirectResponse(url=tour.image_url, status_code=307)
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            return response

        raise HTTPException(status_code=404, detail="Image not found")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка получения изображения тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения изображения")


@router.get("/csv-template")
def download_tours_csv_template(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    headers = list(CSV_FIELD_ALIASES.keys())
    sample = {
        "title": "Сочи: море и экскурсии",
        "description": "Недельный тур с проживанием и базовой программой",
        "price": "45000",
        "duration": "7",
        "start_date": "2026-05-10",
        "end_date": "2026-05-17",
        "country": "Россия",
        "city": "Сочи",
        "max_people": "10",
        "program": "Переезд, размещение, экскурсии и свободное время",
        "accommodation": "Размещение уточняется менеджером",
        "meals": "Завтраки включены",
        "meals_features": "завтраки включены; напитки оплачиваются отдельно",
        "activities": "Обзорная экскурсия и прогулки",
        "activities_features": "часть активностей зависит от погоды",
        "resort_info": "Курорт подходит для семейного отдыха",
        "resort_features": "море; прогулки; экскурсии",
        "program_details": "День 1 — заезд. День 2 — экскурсия.",
        "hotel_name": "Grand Hotel",
        "hotel_address": "Сочи, Курортный проспект, 50",
        "hotel_description": "Отель рядом с основными точками маршрута",
        "hotel_features": "Wi-Fi; завтраки; рядом с морем",
        "hotel_map_lat": "43.585472",
        "hotel_map_lng": "39.723098",
        "hotel_map_zoom": "15",
        "map_lat": "43.585472",
        "map_lng": "39.723098",
        "map_zoom": "12",
        "image_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    }
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerow(sample)
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=tours_import_template.csv"},
    )


def build_tours_csv_response(tours: list[models.Tour], db: Session, filename: str) -> Response:
    headers = [
        "id",
        "title",
        "description",
        "price",
        "duration",
        "start_date",
        "end_date",
        "country",
        "city",
        "max_people",
        "reserved_seats",
        "available_seats",
        "is_archived",
        "rating",
        "review_count",
        "program",
        "accommodation",
        "meals",
        "meals_features",
        "activities",
        "activities_features",
        "resort_info",
        "resort_features",
        "program_details",
        "hotel_name",
        "hotel_address",
        "hotel_description",
        "hotel_features",
        "hotel_map_lat",
        "hotel_map_lng",
        "hotel_map_zoom",
        "map_lat",
        "map_lng",
        "map_zoom",
        "image_url",
        "created_at",
    ]

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()

    for tour in tours:
        reserved_seats, available_seats, is_archived = get_tour_capacity(db, tour)
        writer.writerow({
            "id": tour.id,
            "title": tour.title,
            "description": tour.description or "",
            "price": float(tour.price or 0),
            "duration": tour.duration or 0,
            "start_date": tour.start_date.isoformat() if tour.start_date else "",
            "end_date": tour.end_date.isoformat() if tour.end_date else "",
            "country": tour.country or "",
            "city": tour.city or "",
            "max_people": tour.max_people or 0,
            "reserved_seats": reserved_seats,
            "available_seats": available_seats,
            "is_archived": "yes" if is_archived else "no",
            "rating": float(tour.rating or 0),
            "review_count": tour.review_count or 0,
            "program": tour.program or "",
            "accommodation": tour.accommodation or "",
            "meals": tour.meals or "",
            "meals_features": tour.meals_features or "",
            "activities": tour.activities or "",
            "activities_features": tour.activities_features or "",
            "resort_info": tour.resort_info or "",
            "resort_features": tour.resort_features or "",
            "program_details": tour.program_details or "",
            "hotel_name": tour.hotel_name or "",
            "hotel_address": tour.hotel_address or "",
            "hotel_description": tour.hotel_description or "",
            "hotel_features": tour.hotel_features or "",
            "hotel_map_lat": tour.hotel_map_lat if tour.hotel_map_lat is not None else "",
            "hotel_map_lng": tour.hotel_map_lng if tour.hotel_map_lng is not None else "",
            "hotel_map_zoom": tour.hotel_map_zoom or "",
            "map_lat": tour.map_lat if tour.map_lat is not None else "",
            "map_lng": tour.map_lng if tour.map_lng is not None else "",
            "map_zoom": tour.map_zoom or "",
            "image_url": tour.image_url or "",
            "created_at": tour.created_at.isoformat() if tour.created_at else "",
        })

    ascii_filename = "".join(char if ord(char) < 128 and char not in '\";\r\n' else "_" for char in str(filename)) or "export.csv"
    encoded_filename = quote(str(filename), safe="")

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={ascii_filename}; filename*=UTF-8''{encoded_filename}"
        },
    )


@router.get("/export-csv")
def export_tours_csv(
    search: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    tour_status: str = Query(default="all"),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    query = db.query(models.Tour).options(defer(models.Tour.image_data))

    status_value = (tour_status or "all").lower()
    if status_value == "active":
        query = query.filter(models.Tour.start_date >= date.today())
    elif status_value in ["archived", "archive"]:
        query = query.filter(models.Tour.start_date < date.today())
    elif status_value != "all":
        raise HTTPException(status_code=400, detail="tour_status must be active, archived or all")

    query = apply_tour_filters(
        query,
        search=search,
        country=country,
        sort_by="created_at",
        sort_order="desc",
    )

    tours = query.limit(5000).all()
    return build_tours_csv_response(tours, db, "tours_export.csv")


@router.get("/{tour_id}/export-csv")
def export_single_tour_csv(
    tour_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    safe_title = "_".join(str(tour.title or tour.id).split())[:40] or str(tour.id)
    return build_tours_csv_response([tour], db, f"tour_{tour.id}_{safe_title}.csv")


@router.post("/import-csv", response_model=schemas.TourCsvImportResult)
async def import_tours_from_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    filename = file.filename or "tours.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Загрузите файл в формате CSV")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="CSV-файл пустой")

    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV должен быть сохранён в кодировке UTF-8")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV должен содержать строку заголовков")

    created_ids: list[int] = []
    errors: list[str] = []
    created = 0
    skipped = 0

    for index, row in enumerate(reader, start=2):
        if not any(str(value or "").strip() for value in row.values()):
            skipped += 1
            continue
        try:
            db_tour = build_tour_from_csv_row(row, index)
            db.add(db_tour)
            db.flush()
            created_ids.append(db_tour.id)
            created += 1
        except ValueError as exc:
            skipped += 1
            errors.append(str(exc))
        except Exception as exc:
            skipped += 1
            errors.append(f"строка {index}: {exc}")

    if created == 0 and errors:
        db.rollback()
        return schemas.TourCsvImportResult(created=0, skipped=skipped, errors=errors, created_ids=[])

    db.commit()
    return schemas.TourCsvImportResult(created=created, skipped=skipped, errors=errors[:50], created_ids=created_ids)


@router.get("/{tour_id}", response_model=schemas.TourResponse)
def read_tour(
    tour_id: int,
    db: Session = Depends(get_db),
):
    try:
        tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
        if not tour:
            raise HTTPException(status_code=404, detail="Tour not found")

        return serialize_tour(tour, include_image_data=True, include_gallery=True, db=db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка получения тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения тура")


@router.post("/", response_model=schemas.TourResponse, status_code=status.HTTP_201_CREATED)
def create_tour(
    tour: schemas.TourCreate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    try:
        current_user = auth.get_current_user_from_token(token, db)

        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        if tour.price <= 0:
            raise HTTPException(status_code=400, detail="Price must be greater than 0")

        if tour.duration <= 0:
            raise HTTPException(status_code=400, detail="Duration must be greater than 0")

        if tour.max_people <= 0:
            raise HTTPException(status_code=400, detail="Max people must be greater than 0")

        if tour.end_date < tour.start_date:
            raise HTTPException(status_code=400, detail="End date cannot be earlier than start date")

        image_bytes = None
        image_type = None
        image_url = tour.image_url

        if tour.image_base64:
            image_bytes = decode_image_base64(tour.image_base64)
            image_type = tour.image_type
            image_url = None

        db_tour = models.Tour(
            title=tour.title,
            description=tour.description,
            price=tour.price,
            duration=tour.duration,
            start_date=tour.start_date,
            end_date=tour.end_date,
            country=tour.country,
            city=tour.city,
            max_people=tour.max_people,
            program=tour.program,
            accommodation=tour.accommodation,
            meals=tour.meals,
            meals_features=tour.meals_features,
            activities=tour.activities,
            activities_features=tour.activities_features,
            resort_info=tour.resort_info,
            resort_features=tour.resort_features,
            program_details=tour.program_details,
            hotel_name=tour.hotel_name,
            hotel_address=tour.hotel_address,
            hotel_description=tour.hotel_description,
            hotel_features=tour.hotel_features,
            hotel_map_lat=tour.hotel_map_lat,
            hotel_map_lng=tour.hotel_map_lng,
            hotel_map_zoom=tour.hotel_map_zoom or 15,
            map_lat=tour.map_lat,
            map_lng=tour.map_lng,
            map_zoom=tour.map_zoom or 12,
            image_data=image_bytes,
            image_type=image_type,
            image_url=image_url,
            rating=0,
            review_count=0,
            country_id=tour.country_id,
            resort_id=tour.resort_id,
        )

        db.add(db_tour)
        db.commit()
        db.refresh(db_tour)

        return serialize_tour(db_tour, include_image_data=True, db=db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Ошибка создания тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания тура")


@router.put("/{tour_id}", response_model=schemas.TourResponse)
def update_tour(
    tour_id: int,
    tour_update: schemas.TourUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    try:
        current_user = auth.get_current_user_from_token(token, db)

        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
        if not db_tour:
            raise HTTPException(status_code=404, detail="Tour not found")

        if tour_update.price is not None and tour_update.price <= 0:
            raise HTTPException(status_code=400, detail="Price must be greater than 0")

        if tour_update.duration is not None and tour_update.duration <= 0:
            raise HTTPException(status_code=400, detail="Duration must be greater than 0")

        if tour_update.max_people is not None and tour_update.max_people <= 0:
            raise HTTPException(status_code=400, detail="Max people must be greater than 0")

        new_start_date = (
            tour_update.start_date if tour_update.start_date is not None else db_tour.start_date
        )
        new_end_date = (
            tour_update.end_date if tour_update.end_date is not None else db_tour.end_date
        )

        if new_end_date < new_start_date:
            raise HTTPException(status_code=400, detail="End date cannot be earlier than start date")

        update_data = tour_update.dict(exclude_unset=True)

        regular_fields = [
            "title",
            "description",
            "price",
            "duration",
            "start_date",
            "end_date",
            "country",
            "city",
            "max_people",
            "program",
            "accommodation",
            "meals",
            "meals_features",
            "activities",
            "activities_features",
            "resort_info",
            "resort_features",
            "program_details",
            "hotel_name",
            "hotel_address",
            "hotel_description",
            "hotel_features",
            "hotel_map_lat",
            "hotel_map_lng",
            "hotel_map_zoom",
            "map_lat",
            "map_lng",
            "map_zoom",
            "country_id",
            "resort_id",
        ]

        for field in regular_fields:
            if field in update_data:
                setattr(db_tour, field, update_data[field])

        has_image_base64 = bool(update_data.get("image_base64"))
        has_image_url_field = "image_url" in update_data

        if update_data.get("remove_image") or (has_image_url_field and not update_data.get("image_url") and not has_image_base64):
            db_tour.image_data = None
            db_tour.image_type = None
            db_tour.image_url = None
        elif has_image_base64:
            db_tour.image_data = decode_image_base64(update_data["image_base64"])
            db_tour.image_type = update_data.get("image_type") or "image/jpeg"
            db_tour.image_url = None
        elif has_image_url_field:
            db_tour.image_url = update_data["image_url"] or None
            db_tour.image_data = None
            db_tour.image_type = None

        db.commit()
        db.refresh(db_tour)

        return serialize_tour(db_tour, include_image_data=True, db=db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Ошибка обновления тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления тура")


@router.delete("/{tour_id}")
def delete_tour(
    tour_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    try:
        current_user = auth.get_current_user_from_token(token, db)

        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
        if not db_tour:
            raise HTTPException(status_code=404, detail="Tour not found")

        db.delete(db_tour)
        db.commit()

        return {"message": "Tour deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Ошибка удаления тура: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления тура")
