from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
import base64

router = APIRouter(prefix="/tours", tags=["tours"])

@router.post("/", response_model=schemas.Tour)
def create_tour(tour: schemas.TourCreate, db: Session = Depends(get_db)):
    # Конвертируем base64 изображение в бинарные данные
    image_data = None
    if tour.image_base64 and tour.image_type:
        try:
            # Убираем префикс data:image/...;base64, если он есть
            image_base64 = tour.image_base64
            if image_base64.startswith('data:image'):
                image_base64 = image_base64.split(',')[1]
            image_data = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    db_tour = models.Tour(
        title=tour.title,
        description=tour.description,
        price=tour.price,
        duration=tour.duration,
        start_date=tour.start_date,
        end_date=tour.end_date,
        country=tour.country,
        city=tour.city,
        image_data=image_data,
        image_type=tour.image_type,
        max_people=tour.max_people
    )
    db.add(db_tour)
    db.commit()
    db.refresh(db_tour)
    
    # Конвертируем изображение обратно в base64 для ответа
    image_base64_response = None
    if db_tour.image_data and db_tour.image_type:
        image_base64_response = f"data:{db_tour.image_type};base64," + base64.b64encode(db_tour.image_data).decode()
    
    return schemas.Tour(
        id=db_tour.id,
        title=db_tour.title,
        description=db_tour.description,
        price=db_tour.price,
        duration=db_tour.duration,
        start_date=db_tour.start_date,
        end_date=db_tour.end_date,
        country=db_tour.country,
        city=db_tour.city,
        image_data=image_base64_response,
        image_type=db_tour.image_type,
        max_people=db_tour.max_people,
        created_at=db_tour.created_at
    )

@router.get("/", response_model=List[schemas.Tour])
def read_tours(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tours = db.query(models.Tour).offset(skip).limit(limit).all()
    
    # Конвертируем изображения в base64 для ответа
    tours_response = []
    for tour in tours:
        image_base64 = None
        if tour.image_data and tour.image_type:
            image_base64 = f"data:{tour.image_type};base64," + base64.b64encode(tour.image_data).decode()
        
        tour_response = schemas.Tour(
            id=tour.id,
            title=tour.title,
            description=tour.description,
            price=tour.price,
            duration=tour.duration,
            start_date=tour.start_date,
            end_date=tour.end_date,
            country=tour.country,
            city=tour.city,
            image_data=image_base64,
            image_type=tour.image_type,
            max_people=tour.max_people,
            created_at=tour.created_at
        )
        tours_response.append(tour_response)
    
    return tours_response

@router.get("/{tour_id}", response_model=schemas.Tour)
def read_tour(tour_id: int, db: Session = Depends(get_db)):
    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Конвертируем изображение в base64 для ответа
    image_base64 = None
    if tour.image_data and tour.image_type:
        image_base64 = f"data:{tour.image_type};base64," + base64.b64encode(tour.image_data).decode()
    
    return schemas.Tour(
        id=tour.id,
        title=tour.title,
        description=tour.description,
        price=tour.price,
        duration=tour.duration,
        start_date=tour.start_date,
        end_date=tour.end_date,
        country=tour.country,
        city=tour.city,
        image_data=image_base64,
        image_type=tour.image_type,
        max_people=tour.max_people,
        created_at=tour.created_at
    )

@router.put("/{tour_id}", response_model=schemas.Tour)
def update_tour(tour_id: int, tour: schemas.TourCreate, db: Session = Depends(get_db)):
    db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if db_tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Конвертируем base64 изображение в бинарные данные
    image_data = db_tour.image_data
    image_type = db_tour.image_type
    if tour.image_base64 and tour.image_type:
        try:
            image_base64 = tour.image_base64
            if image_base64.startswith('data:image'):
                image_base64 = image_base64.split(',')[1]
            image_data = base64.b64decode(image_base64)
            image_type = tour.image_type
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    # Обновляем поля
    for key, value in tour.dict().items():
        if key not in ['image_base64', 'image_type']:
            setattr(db_tour, key, value)
    
    db_tour.image_data = image_data
    db_tour.image_type = image_type
    
    db.commit()
    db.refresh(db_tour)
    
    # Конвертируем изображение обратно в base64 для ответа
    image_base64_response = None
    if db_tour.image_data and db_tour.image_type:
        image_base64_response = f"data:{db_tour.image_type};base64," + base64.b64encode(db_tour.image_data).decode()
    
    return schemas.Tour(
        id=db_tour.id,
        title=db_tour.title,
        description=db_tour.description,
        price=db_tour.price,
        duration=db_tour.duration,
        start_date=db_tour.start_date,
        end_date=db_tour.end_date,
        country=db_tour.country,
        city=db_tour.city,
        image_data=image_base64_response,
        image_type=db_tour.image_type,
        max_people=db_tour.max_people,
        created_at=db_tour.created_at
    )

@router.delete("/{tour_id}")
def delete_tour(tour_id: int, db: Session = Depends(get_db)):
    db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if db_tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    db.delete(db_tour)
    db.commit()
    return {"message": "Tour deleted successfully"}
