from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import base64

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/tours", tags=["tours"])

@router.post("/", response_model=schemas.Tour)
def create_tour(tour: schemas.TourCreate, db: Session = Depends(get_db)):
    # Декодируем изображение из base64 если оно есть
    image_data = None
    if tour.image_base64:
        try:
            # Убираем префикс data:image/...
            if ',' in tour.image_base64:
                image_data = base64.b64decode(tour.image_base64.split(',')[1])
            else:
                image_data = base64.b64decode(tour.image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    db_tour = models.Tour(
        title=tour.title,
        description=tour.description,
        program=tour.program,
        price=tour.price,
        duration=tour.duration,
        start_date=tour.start_date,
        end_date=tour.end_date,
        country=tour.country,
        city=tour.city,
        max_people=tour.max_people,
        image_data=image_data,
        image_type=tour.image_type
    )
    db.add(db_tour)
    db.commit()
    db.refresh(db_tour)
    return db_tour

@router.get("/", response_model=List[schemas.Tour])
def read_tours(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tours = db.query(models.Tour).offset(skip).limit(limit).all()
    return tours

@router.get("/{tour_id}", response_model=schemas.Tour)
def read_tour(tour_id: int, db: Session = Depends(get_db)):
    tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    return tour

@router.put("/{tour_id}", response_model=schemas.Tour)
def update_tour(tour_id: int, tour: schemas.TourCreate, db: Session = Depends(get_db)):
    db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if db_tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    
    # Обновляем поля
    for key, value in tour.dict().items():
        if key not in ['image_base64', 'image_type'] and value is not None:
            setattr(db_tour, key, value)
    
    # Обновляем изображение если оно передано
    if tour.image_base64 is not None:
        try:
            if tour.image_base64:
                # Убираем префикс data:image/...
                if ',' in tour.image_base64:
                    image_data = base64.b64decode(tour.image_base64.split(',')[1])
                else:
                    image_data = base64.b64decode(tour.image_base64)
                db_tour.image_data = image_data
                db_tour.image_type = tour.image_type
            else:
                db_tour.image_data = None
                db_tour.image_type = None
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image data")
    
    db.commit()
    db.refresh(db_tour)
    return db_tour

@router.delete("/{tour_id}")
def delete_tour(tour_id: int, db: Session = Depends(get_db)):
    db_tour = db.query(models.Tour).filter(models.Tour.id == tour_id).first()
    if db_tour is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    db.delete(db_tour)
    db.commit()
    return {"message": "Tour deleted successfully"}
