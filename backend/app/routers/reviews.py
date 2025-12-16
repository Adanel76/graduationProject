from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db
from ..auth import oauth2_scheme, get_user

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.post("/", response_model=schemas.Review)
def create_review(review: schemas.ReviewCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверяем, существует ли тур
    tour = db.query(models.Tour).filter(models.Tour.id == review.tour_id).first()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Проверяем, что пользователь еще не оставлял отзыв на этот тур
    existing_review = db.query(models.Review).filter(
        models.Review.user_id == user.id,
        models.Review.tour_id == review.tour_id
    ).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this tour")
    
    # Создаем отзыв
    db_review = models.Review(
        user_id=user.id,
        tour_id=review.tour_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    # Добавляем информацию о пользователе
    db_review.user_first_name = user.first_name
    db_review.user_last_name = user.last_name
    
    return db_review

@router.get("/", response_model=List[schemas.Review])
def read_reviews(db: Session = Depends(get_db)):
    reviews = db.query(models.Review).all()
    
    # Добавляем информацию о пользователях
    result = []
    for review in reviews:
        user = db.query(models.User).filter(models.User.id == review.user_id).first()
        review_dict = {
            "id": review.id,
            "user_id": review.user_id,
            "tour_id": review.tour_id,
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at,
            "user_first_name": user.first_name if user else "",
            "user_last_name": user.last_name if user else ""
        }
        result.append(review_dict)
    
    return result

@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Получаем пользователя из токена
    from jose import jwt
    from ..auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = get_user(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Проверяем права доступа
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if user.role != "admin" and db_review.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db.delete(db_review)
    db.commit()
    return {"message": "Review deleted successfully"}
