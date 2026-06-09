"""Populate the database with rich demo data for the public UI and constructor.

Run from the backend directory:
    python -m app.fill_database

The script is additive and idempotent for tours/events/media: it avoids deleting
existing user data and only creates the missing demo volume.
"""

from __future__ import annotations

import argparse
import mimetypes
import random
import time
import urllib.error
import urllib.request
from datetime import date
from datetime import datetime, timedelta
from decimal import Decimal
from html import escape

from sqlalchemy import func

from . import models
from .bootstrap import ensure_schema_updates
from .database import SessionLocal, engine
from .demo_seed import (
    CITY_EXPERIENCES,
    DEMO_PASSWORD,
    city_media_image,
    city_media_images,
    event_media_image,
    semantic_media_path,
    semantic_media_sources,
    _create_analytics_events,
    _create_notifications,
    _create_tours,
    _create_users,
    _update_tour_ratings,
    _update_user_ratings,
)
from .seed import enrich_tour_content, seed_reference_data


CITY_COLORS = {
    "Москва": ("#1e3a8a", "#b91c1c"),
    "Санкт-Петербург": ("#164e63", "#4338ca"),
    "Сочи": ("#047857", "#0284c7"),
    "Казань": ("#7c2d12", "#15803d"),
    "Стамбул": ("#0f766e", "#1d4ed8"),
    "Анталья": ("#0369a1", "#ea580c"),
    "Дубай": ("#0f172a", "#c2410c"),
    "Шарм-эль-Шейх": ("#0e7490", "#be123c"),
    "Рим": ("#7c2d12", "#1e40af"),
    "Лондон": ("#1f2937", "#9333ea"),
}

CONSTRUCTOR_EVENTS = [
    ("Вечерняя прогулка по Красной площади", "Россия", "Москва", "Короткий городской маршрут с историей центра, подсветкой и свободным временем для фото.", "offline", "news", 8),
    ("Гастрономический вечер в Казани", "Россия", "Казань", "Дегустация локальной кухни и знакомство с традициями татарской гастрономии.", "offline", "promo", 12),
    ("Музейный маршрут Петербурга", "Россия", "Санкт-Петербург", "Подборка главных музеев и дворцовых пространств для насыщенного культурного дня.", "offline", "news", 16),
    ("Сочи: прогулка к морю и закат", "Россия", "Сочи", "Лёгкая программа с набережной, смотровыми точками и вечерним отдыхом.", "offline", "news", 19),
    ("Стамбул: Босфор и Галата", "Турция", "Стамбул", "Прогулка по набережной, Галатской башне и атмосферным кварталам города.", "offline", "news", 22),
    ("Анталья: семейный день у моря", "Турция", "Анталья", "Пляжный день с мягкой программой, прогулкой по старому городу и свободным временем.", "offline", "promo", 27),
    ("Дубай: современная архитектура", "ОАЭ", "Дубай", "Маршрут по смотровым площадкам, набережным и главным городским объектам.", "offline", "news", 31),
    ("Красное море: снорклинг-программа", "Египет", "Шарм-эль-Шейх", "Водная активность для знакомства с рифами и спокойного отдыха на море.", "offline", "promo", 34),
    ("Рим: вечерний Трастевере", "Италия", "Рим", "Неспешная прогулка по кварталу, локальные кафе и городская атмосфера.", "offline", "news", 39),
    ("Лондон: музеи и Вестминстер", "Великобритания", "Лондон", "Городской маршрут с музеями, историческими улицами и классическими видами.", "offline", "news", 44),
]


def _status_ids(db):
    return {row.code: row.id for row in db.query(models.BookingStatus).all()}


def _payment_status_ids(db):
    return {row.code: row.id for row in db.query(models.PaymentStatus).all()}


def _payment_method_ids(db):
    return {row.code: row.id for row in db.query(models.PaymentMethod).all()}


def build_svg_bytes(label: str, color_a: str, color_b: str, subtitle: str = "Travel Agency") -> bytes:
    safe_label = escape(label)
    safe_subtitle = escape(subtitle)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920" viewBox="0 0 1400 920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{color_a}"/>
      <stop offset="1" stop-color="{color_b}"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="1400" height="920" fill="url(#bg)"/>
  <circle cx="1120" cy="160" r="210" fill="rgba(255,255,255,0.17)" filter="url(#soft)"/>
  <circle cx="190" cy="720" r="250" fill="rgba(255,255,255,0.12)" filter="url(#soft)"/>
  <path d="M0 650 C250 530 390 710 620 590 C850 470 980 550 1400 390 L1400 920 L0 920 Z" fill="rgba(255,255,255,0.22)"/>
  <path d="M0 720 C280 640 480 790 760 680 C990 590 1160 620 1400 520 L1400 920 L0 920 Z" fill="rgba(15,23,42,0.18)"/>
  <text x="86" y="132" fill="rgba(255,255,255,0.72)" font-family="Inter, Segoe UI, Arial" font-size="34" font-weight="700">{safe_subtitle}</text>
  <text x="86" y="470" fill="#ffffff" font-family="Inter, Segoe UI, Arial" font-size="92" font-weight="800">{safe_label}</text>
  <text x="90" y="542" fill="rgba(255,255,255,0.78)" font-family="Inter, Segoe UI, Arial" font-size="34" font-weight="600">демонстрационное изображение из БД</text>
</svg>"""
    return svg.encode("utf-8")


def image_for_city(city: str, fallback: str = "Travel") -> bytes:
    color_a, color_b = CITY_COLORS.get(city, ("#1e3a8a", "#0f766e"))
    return build_svg_bytes(city or fallback, color_a, color_b)


def cache_semantic_media_assets() -> int:
    cached = 0
    for source_url in semantic_media_sources():
        target_path = semantic_media_path(source_url)
        if target_path.exists() and target_path.stat().st_size > 1024:
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(
            source_url,
            headers={"User-Agent": "TravelAgencyDiploma/1.0 (local media cache)"},
        )
        image_bytes = None
        content_type = ""

        for attempt in range(4):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    image_bytes = response.read()
                    content_type = response.headers.get_content_type()
                break
            except urllib.error.HTTPError as exc:
                if exc.code != 429 or attempt == 3:
                    raise
                time.sleep(3 * (attempt + 1))

        if not image_bytes or not content_type.startswith("image/"):
            raise RuntimeError(f"Источник не вернул изображение: {source_url}")

        expected_suffix = mimetypes.guess_extension(content_type) or target_path.suffix
        if target_path.suffix == ".jpg" and expected_suffix == ".jpe":
            expected_suffix = ".jpg"
        target_path.write_bytes(image_bytes)
        cached += 1
        time.sleep(0.35)

    return cached


def fill_tour_images(db) -> int:
    changed = 0
    tours = db.query(models.Tour).order_by(models.Tour.id.asc()).all()
    city_variants = {}

    for tour in tours:
        city = tour.city or ""
        city_variant = city_variants.get(city, 0)
        image_url = city_media_image(city, city_variant)
        city_variants[city] = city_variant + 1
        if image_url and (
            tour.image_url != image_url
            or tour.image_data is not None
            or tour.image_type is not None
        ):
            tour.image_url = image_url
            tour.image_data = None
            tour.image_type = None
            changed += 1

        city_images = city_media_images(city)
        gallery_urls = [
            city_images[(city_variant + offset) % len(city_images)]
            for offset in range(1, min(4, len(city_images)))
        ] if city_images else []
        automatic_images = [
            image
            for image in tour.gallery_images
            if (image.alt_text or "").startswith("Автоматическая галерея:")
        ]

        for sort_order, gallery_url in enumerate(gallery_urls, start=1):
            if sort_order <= len(automatic_images):
                gallery_image = automatic_images[sort_order - 1]
            else:
                gallery_image = models.TourImage(tour_id=tour.id)
                db.add(gallery_image)

            alt_text = f"Автоматическая галерея: {city}, фото {sort_order + 1}"
            if (
                gallery_image.image_url != gallery_url
                or gallery_image.image_data is not None
                or gallery_image.image_type is not None
                or gallery_image.alt_text != alt_text
                or gallery_image.sort_order != sort_order
            ):
                gallery_image.image_url = gallery_url
                gallery_image.image_data = None
                gallery_image.image_type = None
                gallery_image.alt_text = alt_text
                gallery_image.sort_order = sort_order
                changed += 1

    return changed


def upsert_constructor_events(db) -> int:
    changed = 0
    prepared_events = list(CONSTRUCTOR_EVENTS)
    existing_signatures = {(country, city, title) for title, country, city, *_ in prepared_events}
    event_offset = 12

    for city, experiences in CITY_EXPERIENCES.items():
        tour = db.query(models.Tour).filter(models.Tour.city == city).first()
        if not tour:
            continue

        for index, experience in enumerate(experiences[:2]):
            title = f"{city}: {experience}"
            signature = (tour.country, city, title)
            if signature in existing_signatures:
                continue

            prepared_events.append(
                (
                    title,
                    tour.country,
                    city,
                    f"{experience}. Продуманная активность с организационными деталями, временем для фотографий и свободной частью программы.",
                    "offline",
                    "promo" if index else "news",
                    event_offset,
                )
            )
            existing_signatures.add(signature)
            event_offset += 3

    for event_index, (title, country, city, summary, format_type, event_type, day_offset) in enumerate(prepared_events):
        event = db.query(models.Event).filter(models.Event.title == title).first()
        if not event:
            event = models.Event(title=title, content=summary, event_type=event_type)
            db.add(event)
            changed += 1

        event.summary = summary
        event.content = f"{summary} Мероприятие добавлено как демонстрационные данные для конструктора маршрутов."
        event.event_type = event_type
        event.format_type = format_type
        event.country = country
        event.city = city
        event.start_date = datetime.utcnow() + timedelta(days=day_offset)
        event.end_date = event.start_date + timedelta(hours=3)
        event.is_featured = day_offset in {8, 22, 31}
        event.is_published = True

    city_event_variants = {}
    for event in db.query(models.Event).order_by(models.Event.id.asc()).all():
        city = event.city or ""
        city_variant = city_event_variants.get(city, 0)
        image_url = event_media_image(event.title, city, city_variant)
        city_event_variants[city] = city_variant + 1
        if image_url and (
            event.image_url != image_url
            or event.image_data is not None
            or event.image_type is not None
        ):
            event.image_url = image_url
            event.image_data = None
            event.image_type = None
            changed += 1

    return changed


def create_safe_bookings(db, users, tours, bookings_count: int) -> list[models.Booking]:
    rnd = random.Random(20260524 + db.query(models.Booking).count())
    clients = [user for user in users if user.role == "client"]
    active_tours = [tour for tour in tours if tour.id]

    if not clients or not active_tours or bookings_count <= 0:
        return []

    status_ids = _status_ids(db)
    payment_status_ids = _payment_status_ids(db)
    method_ids = _payment_method_ids(db)
    methods = list(method_ids.keys()) or ["card"]
    created = []

    for _ in range(bookings_count):
        user = rnd.choice(clients)
        tour = rnd.choice(active_tours)
        people_count = rnd.choices([1, 2, 3, 4], weights=[24, 48, 20, 8], k=1)[0]
        booking_date = datetime.utcnow() - timedelta(
            days=rnd.randint(0, 180),
            hours=rnd.randint(0, 12),
            minutes=rnd.randint(0, 59),
        )

        if tour.start_date and tour.start_date < date.today():
            status = rnd.choices(["completed", "cancelled", "confirmed"], weights=[68, 18, 14], k=1)[0]
        else:
            status = rnd.choices(["confirmed", "pending", "cancelled"], weights=[56, 32, 12], k=1)[0]

        payment_status = "paid" if status in {"confirmed", "completed"} else rnd.choice(["pending", "failed"])
        payment_method = rnd.choice(methods)
        discount = Decimal(str(rnd.choice([0, 0, 0, 1000, 2000, 5000])))
        total_price = max(Decimal(str(tour.price or 0)) * people_count - discount, Decimal("0"))

        booking = models.Booking(
            user_id=user.id,
            tour_id=tour.id,
            booking_date=booking_date,
            status=status,
            people_count=people_count,
            total_price=total_price,
            discount_amount=discount,
            payment_status=payment_status,
            payment_method=payment_method,
            status_id=status_ids.get(status),
            payment_status_id=payment_status_ids.get(payment_status),
            payment_method_id=method_ids.get(payment_method),
        )
        db.add(booking)
        db.flush()
        created.append(booking)

        db.add(models.BookingStatusHistory(
            booking_id=booking.id,
            old_status_id=None,
            new_status_id=status_ids.get(status),
            note="Демо-данные для заполнения базы",
            changed_at=booking_date + timedelta(minutes=rnd.randint(10, 180)),
        ))

        if payment_status == "paid":
            db.add(models.Payment(
                booking_id=booking.id,
                payment_method_id=method_ids.get(payment_method),
                payment_status_id=payment_status_ids.get("paid"),
                amount=total_price,
                paid_at=booking_date + timedelta(hours=rnd.randint(1, 36)),
                created_at=booking_date + timedelta(minutes=30),
            ))

        has_review = db.query(models.Review).filter(
            models.Review.user_id == user.id,
            models.Review.tour_id == tour.id,
        ).first()
        if status == "completed" and not has_review and rnd.random() < 0.55:
            db.add(models.Review(
                user_id=user.id,
                tour_id=tour.id,
                rating=rnd.choices([3, 4, 5], weights=[8, 34, 58], k=1)[0],
                comment=rnd.choice([
                    "Понравилась организация тура и работа менеджера.",
                    "Маршрут удобный, программа понятная, поездка прошла спокойно.",
                    "Хорошая подборка активностей и комфортное размещение.",
                    "Тур соответствует описанию, детали были понятны до оплаты.",
                ]),
                created_at=booking_date + timedelta(days=rnd.randint(12, 80)),
            ))

    return created


def fill_database(target_bookings: int = 260, target_analytics_events: int = 420) -> dict:
    models.Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    media_cached = cache_semantic_media_assets()

    db = SessionLocal()
    try:
        seed_reference_data(db)

        users = _create_users(db, reset=False)
        tours = _create_tours(db, reset=False)
        db.commit()

        enrich_tour_content(db)

        bookings_before = db.query(models.Booking).count()
        missing_bookings = max(0, target_bookings - bookings_before)
        bookings = []
        if missing_bookings:
            bookings = create_safe_bookings(db, users, tours, bookings_count=missing_bookings)

        analytics_before = db.query(models.AnalyticsEvent).count()
        if analytics_before < target_analytics_events:
            _create_analytics_events(db, users, tours)

        if db.query(models.Notification).count() < 20:
            _create_notifications(db, users)

        tour_images_changed = fill_tour_images(db)
        events_changed = upsert_constructor_events(db)
        db.commit()

        _update_tour_ratings(db, tours)
        _update_user_ratings(db, users)
        db.commit()

        return {
            "database": engine.dialect.name,
            "demo_password": DEMO_PASSWORD,
            "media_cached": media_cached,
            "bookings_added": len(bookings),
            "tour_images_filled": tour_images_changed,
            "events_created_or_updated": events_changed,
            "countries": db.query(models.Country).count(),
            "resorts": db.query(models.Resort).count(),
            "tours": db.query(models.Tour).count(),
            "events": db.query(models.Event).count(),
            "users": db.query(models.User).count(),
            "bookings": db.query(models.Booking).count(),
            "analytics_events": db.query(models.AnalyticsEvent).count(),
            "tours_with_image_data": db.query(models.Tour).filter(models.Tour.image_data.isnot(None)).count(),
            "events_with_image_data": db.query(models.Event).filter(models.Event.image_data.isnot(None)).count(),
        }
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Fill Travel Agency database with demo content.")
    parser.add_argument("--bookings", type=int, default=260, help="Minimum total bookings after filling.")
    parser.add_argument("--analytics-events", type=int, default=420, help="Minimum analytics events after filling.")
    args = parser.parse_args()

    result = fill_database(
        target_bookings=max(40, args.bookings),
        target_analytics_events=max(100, args.analytics_events),
    )

    print("\n=== Travel Agency database fill ===")
    for key, value in result.items():
        print(f"{key}: {value}")
    print("\nДемо-клиент: client01@demo.travel / demo12345")
    print("Демо-аналитик: analyst.demo@demo.travel / demo12345")


if __name__ == "__main__":
    main()
