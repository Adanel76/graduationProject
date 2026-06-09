from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, defer

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/favorites", tags=["favorites"])


def serialize_tour(tour: models.Tour, include_image_data: bool = False) -> schemas.TourResponse:
    image_data = None

    if include_image_data and getattr(tour, "image_data", None):
        import base64
        encoded = base64.b64encode(tour.image_data).decode("utf-8")
        image_data = f"data:{tour.image_type or 'image/jpeg'};base64,{encoded}"

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
        image_data=image_data,
        image_type=tour.image_type,
        image_url=tour.image_url,
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
        rating=float(tour.rating) if tour.rating is not None else 0,
        review_count=tour.review_count or 0,
        created_at=tour.created_at,
        country_id=tour.country_id,
        resort_id=tour.resort_id,
    )


@router.get("/", response_model=List[schemas.TourResponse])
def get_favorites(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    tours = (
        db.query(models.Tour)
        .join(models.Favorite, models.Favorite.tour_id == models.Tour.id)
        .filter(models.Favorite.user_id == current_user.id)
        .options(defer(models.Tour.image_data))
        .order_by(models.Favorite.created_at.desc(), models.Favorite.id.desc())
        .all()
    )

    return [serialize_tour(tour, include_image_data=False) for tour in tours]


@router.post("/", response_model=schemas.FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_to_favorites(
    favorite: schemas.FavoriteCreate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    tour = db.query(models.Tour).filter(models.Tour.id == favorite.tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    existing_favorite = (
        db.query(models.Favorite)
        .filter(
            models.Favorite.user_id == current_user.id,
            models.Favorite.tour_id == favorite.tour_id,
        )
        .first()
    )

    if existing_favorite:
        return existing_favorite

    db_favorite = models.Favorite(
        user_id=current_user.id,
        tour_id=favorite.tour_id,
    )
    db.add(db_favorite)
    db.commit()
    db.refresh(db_favorite)

    return db_favorite


@router.delete("/{tour_id}")
def remove_from_favorites(
    tour_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    favorite = (
        db.query(models.Favorite)
        .filter(
            models.Favorite.user_id == current_user.id,
            models.Favorite.tour_id == tour_id,
        )
        .first()
    )

    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    db.delete(favorite)
    db.commit()

    return {"message": "Removed from favorites"}


@router.get("/check/{tour_id}")
def check_favorite(
    tour_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    exists = (
        db.query(models.Favorite.id)
        .filter(
            models.Favorite.user_id == current_user.id,
            models.Favorite.tour_id == tour_id,
        )
        .first()
        is not None
    )

    return {"is_favorite": exists}