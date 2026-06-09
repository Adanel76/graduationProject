from typing import List, Optional
import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..auth import oauth2_scheme
from ..database import get_db

router = APIRouter(prefix="/events", tags=["events"])


def decode_image_base64(image_base64: str) -> bytes:
    try:
        return base64.b64decode(image_base64)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image_base64")


def serialize_event(event: models.Event) -> schemas.EventResponse:
    return schemas.EventResponse(
        id=event.id,
        title=event.title,
        summary=event.summary,
        content=event.content,
        event_type=event.event_type,
        format_type=event.format_type,
        country=event.country,
        city=event.city,
        start_date=event.start_date,
        end_date=event.end_date,
        image_url=event.image_url,
        image_data=base64.b64encode(event.image_data).decode("utf-8") if event.image_data else None,
        image_type=event.image_type,
        is_featured=event.is_featured,
        is_published=event.is_published,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )




def validate_event_dates(start_date, end_date):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="Дата окончания события не может быть раньше даты начала")


@router.get("/", response_model=List[schemas.EventResponse])
def read_events(
    event_type: Optional[str] = Query(default=None),
    format_type: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    featured_only: bool = Query(default=False),
    upcoming_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(models.Event).filter(models.Event.is_published == True)

    if event_type:
        query = query.filter(models.Event.event_type == event_type)

    if format_type:
        query = query.filter(models.Event.format_type == format_type)

    if country:
        query = query.filter(models.Event.country == country)

    if city:
        query = query.filter(models.Event.city == city)

    if featured_only:
        query = query.filter(models.Event.is_featured == True)

    if upcoming_only:
        query = query.filter(models.Event.start_date.isnot(None))
        query = query.filter(models.Event.start_date >= func.now())

    events = (
        query.order_by(
            models.Event.is_featured.desc(),
            models.Event.start_date.desc().nullslast(),
            models.Event.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [serialize_event(event) for event in events]


@router.get("/admin/all", response_model=List[schemas.EventResponse])
def read_admin_events(
    event_type: Optional[str] = Query(default=None),
    format_type: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    featured_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    query = db.query(models.Event)

    if event_type:
        query = query.filter(models.Event.event_type == event_type)

    if format_type:
        query = query.filter(models.Event.format_type == format_type)

    if country:
        query = query.filter(models.Event.country == country)

    if city:
        query = query.filter(models.Event.city == city)

    if featured_only:
        query = query.filter(models.Event.is_featured == True)

    events = (
        query.order_by(
            models.Event.is_featured.desc(),
            models.Event.start_date.desc().nullslast(),
            models.Event.id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [serialize_event(event) for event in events]


@router.get("/{event_id}", response_model=schemas.EventResponse)
def read_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id, models.Event.is_published == True)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return serialize_event(event)


@router.post("/", response_model=schemas.EventResponse)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    validate_event_dates(event.start_date, event.end_date)

    image_bytes = None
    image_type = None
    image_url = event.image_url

    if event.image_base64:
        image_bytes = decode_image_base64(event.image_base64)
        image_type = event.image_type
        image_url = None

    db_event = models.Event(
        title=event.title,
        summary=event.summary,
        content=event.content,
        event_type=event.event_type,
        format_type=event.format_type,
        country=event.country,
        city=event.city,
        start_date=event.start_date,
        end_date=event.end_date,
        image_url=image_url,
        image_data=image_bytes,
        image_type=image_type,
        is_featured=event.is_featured,
        is_published=event.is_published,
    )

    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    return serialize_event(db_event)


@router.put("/{event_id}", response_model=schemas.EventResponse)
def update_event(
    event_id: int,
    event_update: schemas.EventUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_update.model_dump(exclude_unset=True)

    validate_event_dates(update_data.get("start_date", db_event.start_date), update_data.get("end_date", db_event.end_date))

    regular_fields = [
        "title",
        "summary",
        "content",
        "event_type",
        "format_type",
        "country",
        "city",
        "start_date",
        "end_date",
        "is_featured",
        "is_published",
    ]

    for field in regular_fields:
        if field in update_data:
            setattr(db_event, field, update_data[field])

    if update_data.get("remove_image"):
        db_event.image_data = None
        db_event.image_type = None
        db_event.image_url = None
    elif "image_base64" in update_data and update_data["image_base64"]:
        db_event.image_data = decode_image_base64(update_data["image_base64"])
        db_event.image_type = update_data.get("image_type") or "image/jpeg"
        db_event.image_url = None
    elif "image_url" in update_data:
        db_event.image_url = update_data["image_url"] or None
        if update_data["image_url"]:
            db_event.image_data = None
            db_event.image_type = None

    db.commit()
    db.refresh(db_event)

    return serialize_event(db_event)


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(db_event)
    db.commit()

    return {"message": "Event deleted successfully"}