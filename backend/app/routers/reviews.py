from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/reviews", tags=["reviews"])


def serialize_review(review: models.Review) -> schemas.ReviewResponse:
    return schemas.ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        tour_id=review.tour_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        user_first_name=review.user.first_name if review.user else None,
        user_last_name=review.user.last_name if review.user else None,
    )


def refresh_tour_rating(db: Session, tour_id: int):
    stats = (
        db.query(
            func.count(models.Review.id).label("reviews_count"),
            func.avg(models.Review.rating).label("avg_rating"),
        )
        .filter(models.Review.tour_id == tour_id)
        .first()
    )

    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if not tour:
        return

    tour.review_count = int(stats.reviews_count or 0)
    tour.rating = float(stats.avg_rating or 0)
    db.commit()


@router.get("/", response_model=List[schemas.ReviewResponse])
def get_reviews(
    tour_id: Optional[int] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .order_by(models.Review.created_at.desc(), models.Review.id.desc())
    )

    if tour_id is not None:
        query = query.filter(models.Review.tour_id == tour_id)

    reviews = query.offset(skip).limit(limit).all()
    return [serialize_review(review) for review in reviews]


@router.get("/{review_id}", response_model=schemas.ReviewResponse)
def get_review_by_id(
    review_id: int,
    db: Session = Depends(get_db),
):
    review = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.id == review_id)
        .first()
    )

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return serialize_review(review)


@router.post("/", response_model=schemas.ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Рейтинг должен быть от 1 до 5")

    tour = db.query(models.Tour).filter(models.Tour.id == review.tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    # Только после подтвержденного или завершенного бронирования
    eligible_booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.user_id == current_user.id,
            models.Booking.tour_id == review.tour_id,
            models.Booking.status.in_(["confirmed", "completed"]),
        )
        .first()
    )

    if not eligible_booking:
        raise HTTPException(
            status_code=403,
            detail="Оставить отзыв можно только после подтвержденного или завершенного бронирования",
        )

    existing_review = (
        db.query(models.Review)
        .filter(
            models.Review.user_id == current_user.id,
            models.Review.tour_id == review.tour_id,
        )
        .first()
    )

    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="Вы уже оставляли отзыв на этот тур",
        )

    db_review = models.Review(
        user_id=current_user.id,
        tour_id=review.tour_id,
        rating=review.rating,
        comment=(review.comment or "").strip() or None,
    )

    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    refresh_tour_rating(db, review.tour_id)

    db_review = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.id == db_review.id)
        .first()
    )

    return serialize_review(db_review)


@router.put("/{review_id}", response_model=schemas.ReviewResponse)
def update_review(
    review_id: int,
    review_update: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    db_review = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.id == review_id)
        .first()
    )

    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

    is_staff = current_user.role in ["admin", "manager"]
    is_owner = db_review.user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if review_update.rating is not None:
        if review_update.rating < 1 or review_update.rating > 5:
            raise HTTPException(status_code=400, detail="Рейтинг должен быть от 1 до 5")
        db_review.rating = review_update.rating

    if review_update.comment is not None:
        db_review.comment = review_update.comment.strip() or None

    db.commit()
    db.refresh(db_review)

    refresh_tour_rating(db, db_review.tour_id)

    db_review = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.id == review_id)
        .first()
    )

    return serialize_review(db_review)


@router.delete("/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")

    is_staff = current_user.role in ["admin", "manager"]
    is_owner = db_review.user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tour_id = db_review.tour_id

    db.delete(db_review)
    db.commit()

    refresh_tour_rating(db, tour_id)

    return {"message": "Review deleted successfully"}