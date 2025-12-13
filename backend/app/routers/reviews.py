from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..auth import oauth2_scheme
from ..auth import get_user
from jose import JWTError, jwt
from ..auth import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/reviews", tags=["reviews"])

def get_current_user_from_token(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(db, email=email)
    if user is None:
        raise credentials_exception
    return user

@router.post("/", response_model=schemas.Review)
def create_review(
    review: schemas.ReviewCreate, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Получаем текущего пользователя из токена
    current_user = get_current_user_from_token(token, db)
    
    db_review = models.Review(
        user_id=current_user.id,
        tour_id=review.tour_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    # Добавляем информацию о пользователе для ответа
    review_response = schemas.Review(
        id=db_review.id,
        user_id=db_review.user_id,
        user_first_name=current_user.first_name,
        user_last_name=current_user.last_name,
        tour_id=db_review.tour_id,
        rating=db_review.rating,
        comment=db_review.comment,
        created_at=db_review.created_at
    )
    
    return review_response

@router.get("/", response_model=List[schemas.Review])
def read_reviews(db: Session = Depends(get_db)):
    # Делаем join с таблицей users для получения информации о пользователе
    reviews_with_users = db.query(
        models.Review.id,
        models.Review.user_id,
        models.Review.tour_id,
        models.Review.rating,
        models.Review.comment,
        models.Review.created_at,
        models.User.first_name,
        models.User.last_name
    ).join(models.User, models.Review.user_id == models.User.id).all()
    
    # Преобразуем результаты в нужный формат
    reviews_response = []
    for review in reviews_with_users:
        review_response = schemas.Review(
            id=review.id,
            user_id=review.user_id,
            user_first_name=review.first_name,
            user_last_name=review.last_name,
            tour_id=review.tour_id,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at
        )
        reviews_response.append(review_response)
    
    return reviews_response

@router.get("/{review_id}", response_model=schemas.Review)
def read_review(review_id: int, db: Session = Depends(get_db)):
    # Делаем join с таблицей users
    review_with_user = db.query(
        models.Review.id,
        models.Review.user_id,
        models.Review.tour_id,
        models.Review.rating,
        models.Review.comment,
        models.Review.created_at,
        models.User.first_name,
        models.User.last_name
    ).join(models.User, models.Review.user_id == models.User.id).filter(models.Review.id == review_id).first()
    
    if review_with_user is None:
        raise HTTPException(status_code=404, detail="Review not found")
    
    review_response = schemas.Review(
        id=review_with_user.id,
        user_id=review_with_user.user_id,
        user_first_name=review_with_user.first_name,
        user_last_name=review_with_user.last_name,
        tour_id=review_with_user.tour_id,
        rating=review_with_user.rating,
        comment=review_with_user.comment,
        created_at=review_with_user.created_at
    )
    
    return review_response

# Остальные методы остаются без изменений
@router.put("/{review_id}", response_model=schemas.Review)
def update_review(
    review_id: int, 
    review_update: schemas.ReviewCreate, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    current_user = get_current_user_from_token(token, db)
    
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if db_review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if db_review.user_id != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    for key, value in review_update.dict().items():
        setattr(db_review, key, value)
    
    db.commit()
    db.refresh(db_review)
    
    # Получаем информацию о пользователе для ответа
    user = db.query(models.User).filter(models.User.id == db_review.user_id).first()
    review_response = schemas.Review(
        id=db_review.id,
        user_id=db_review.user_id,
        user_first_name=user.first_name,
        user_last_name=user.last_name,
        tour_id=db_review.tour_id,
        rating=db_review.rating,
        comment=db_review.comment,
        created_at=db_review.created_at
    )
    
    return review_response

@router.delete("/{review_id}")
def delete_review(
    review_id: int, 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    current_user = get_current_user_from_token(token, db)
    
    db_review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if db_review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if db_review.user_id != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db.delete(db_review)
    db.commit()
    return {"message": "Review deleted successfully"}
