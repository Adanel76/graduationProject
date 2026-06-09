from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models


def _ensure_named_rows(db: Session, model, rows: list[dict], key: str = "code"):
    for row in rows:
        value = row[key]
        exists = db.query(model).filter(getattr(model, key) == value).first()
        if not exists:
            db.add(model(**row))
    db.commit()


REFERENCE_BOOKING_STATUSES = [
    {"code": "pending", "name": "Ожидает подтверждения"},
    {"code": "confirmed", "name": "Подтверждено"},
    {"code": "cancelled", "name": "Отменено"},
    {"code": "completed", "name": "Завершено"},
]

REFERENCE_PAYMENT_STATUSES = [
    {"code": "pending", "name": "Ожидает оплаты"},
    {"code": "paid", "name": "Оплачено"},
    {"code": "failed", "name": "Ошибка оплаты"},
]

REFERENCE_PAYMENT_METHODS = [
    {"code": "card", "name": "Банковская карта"},
    {"code": "cash", "name": "Наличные"},
    {"code": "transfer", "name": "Перевод"},
]

DEFAULT_EVENTS = [
    {
        "title": "Летняя подборка направлений 2026",
        "summary": "Обзор самых востребованных маршрутов сезона и рекомендации по раннему бронированию.",
        "content": "Мы собрали направления, которые чаще всего выбирают клиенты перед летним сезоном: культурные туры, семейный отдых и короткие поездки на выходные. Используйте фильтры каталога, чтобы быстро сравнить стоимость, даты и свободные места.",
        "event_type": "news",
        "format_type": "info",
        "country": "Россия",
        "city": "Москва",
        "start_date": datetime.utcnow() + timedelta(days=2),
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
        "is_featured": True,
        "is_published": True,
    },
    {
        "title": "Как выбрать тур по бюджету",
        "summary": "Практический материал о том, как подобрать поездку без лишних расходов.",
        "content": "Сравнивайте не только цену тура, но и включённые услуги: проживание, питание, активности и трансфер. В карточке каждого тура теперь есть отдельный блок с составом пакета.",
        "event_type": "update",
        "format_type": "info",
        "country": None,
        "city": None,
        "start_date": datetime.utcnow() + timedelta(days=5),
        "image_url": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80",
        "is_featured": False,
        "is_published": True,
    },
    {
        "title": "Вебинар для менеджеров: работа с заявками",
        "summary": "Разбор статусов бронирований, комментариев и уведомлений клиента.",
        "content": "На вебинаре разбираем полный цикл заявки: создание клиентом, подтверждение менеджером, отмена, завершение и влияние статуса на свободные места тура.",
        "event_type": "webinar",
        "format_type": "online",
        "country": None,
        "city": None,
        "start_date": datetime.utcnow() + timedelta(days=9),
        "image_url": "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80",
        "is_featured": False,
        "is_published": True,
    },
    {
        "title": "Акция на раннее бронирование",
        "summary": "Специальные условия для клиентов, которые планируют поездку заранее.",
        "content": "Раннее бронирование помогает закрепить места в группе и получить более выгодные условия. Количество мест в турах обновляется автоматически после создания и изменения заявок.",
        "event_type": "promo",
        "format_type": "info",
        "country": None,
        "city": None,
        "start_date": datetime.utcnow() + timedelta(days=14),
        "image_url": "https://images.unsplash.com/photo-1498307833015-e7b400441eb8?auto=format&fit=crop&w=1400&q=80",
        "is_featured": False,
        "is_published": True,
    },
]


def seed_default_events(db: Session):
    if db.query(models.Event).count() > 0:
        return

    for row in DEFAULT_EVENTS:
        db.add(models.Event(**row))
    db.commit()


def enrich_tour_content(db: Session):
    tours = db.query(models.Tour).all()
    changed = False

    for tour in tours:
        location = ", ".join([value for value in [tour.city, tour.country] if value]) or "направлению"

        if not tour.accommodation:
            tour.accommodation = f"Комфортное размещение на маршруте {location}. Тип проживания уточняется менеджером при подтверждении заявки."
            changed = True
        if not tour.meals:
            tour.meals = "Базовое питание по программе тура. Детали зависят от отеля и формата поездки."
            changed = True
        if not getattr(tour, "meals_features", None):
            tour.meals_features = "формат питания уточняется в карточке тура\nособые пожелания можно указать при бронировании\nдополнительные услуги согласуются отдельно"
            changed = True
        if not tour.activities:
            tour.activities = "Экскурсионные и свободные активности по программе. Точный график доступен после подтверждения бронирования."
            changed = True
        if not getattr(tour, "activities_features", None):
            tour.activities_features = "программа может зависеть от сезона и погоды\nчасть активностей проводится по расписанию группы\nдополнительные экскурсии согласуются отдельно"
            changed = True
        if not tour.resort_info:
            tour.resort_info = f"Актуальная информация о направлении {location}: сезонность, особенности отдыха и рекомендации перед поездкой."
            changed = True
        if not getattr(tour, "resort_features", None):
            tour.resort_features = "сезонность зависит от направления\nрекомендации перед поездкой уточняются менеджером\nключевые особенности курорта доступны в карточке тура"
            changed = True
        if not tour.program:
            tour.program = "Программа формируется по дням и может включать обзорные прогулки, свободное время и дополнительные экскурсии."
            changed = True
        if not tour.program_details:
            tour.program_details = "Подробный маршрут и организационные детали уточняются менеджером после оформления заявки."
            changed = True
        if not getattr(tour, "hotel_name", None):
            tour.hotel_name = "Отель по программе тура"
            changed = True
        if not getattr(tour, "hotel_address", None):
            tour.hotel_address = location
            changed = True
        if not getattr(tour, "hotel_description", None):
            tour.hotel_description = "Информация об отеле, адресе и условиях размещения заполняется менеджером или администратором в карточке тура."
            changed = True
        if not getattr(tour, "hotel_features", None):
            tour.hotel_features = "комфортное размещение\nусловия заселения уточняются при подтверждении\nхарактеристики отеля доступны в карточке тура"
            changed = True

    if changed:
        db.commit()


def seed_reference_data(db: Session):
    _ensure_named_rows(db, models.BookingStatus, REFERENCE_BOOKING_STATUSES)
    _ensure_named_rows(db, models.PaymentStatus, REFERENCE_PAYMENT_STATUSES)
    _ensure_named_rows(db, models.PaymentMethod, REFERENCE_PAYMENT_METHODS)
    seed_default_events(db)
    enrich_tour_content(db)


def seed_demo_data(db: Session):
    if db.query(models.Country).count() == 0:
        db.add(models.Country(name="Россия", code="RU"))
        db.commit()
