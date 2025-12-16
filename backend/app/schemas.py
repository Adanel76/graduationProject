from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List

# User schemas
class UserBase(BaseModel):
    email: str
    first_name: str
    last_name: str
    phone: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

# Схемы для подтверждения email
class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str

class User(UserBase):
    id: int
    role: str
    is_verified: bool  # Добавили
    created_at: datetime
    
    class Config:
        from_attributes = True

# Tour schemas
class TourBase(BaseModel):
    title: str
    description: str
    price: float
    duration: int
    start_date: date
    end_date: date
    country: str
    city: str
    max_people: int

class TourCreate(TourBase):
    image_base64: Optional[str] = None
    image_type: Optional[str] = None

class Tour(TourBase):
    id: int
    image_data: Optional[str] = None
    image_type: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Booking schemas
class BookingBase(BaseModel):
    tour_id: int
    people_count: int

class BookingCreate(BookingBase):
    pass

class Booking(BookingBase):
    id: int
    user_id: int
    booking_date: datetime
    status: str
    
    class Config:
        from_attributes = True

# Review schemas
class ReviewBase(BaseModel):
    tour_id: int
    rating: int
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class Review(ReviewBase):
    id: int
    user_id: int
    user_first_name: str
    user_last_name: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str = None

# Схемы для сброса пароля
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str

# Tour schemas
class TourBase(BaseModel):
    title: str
    description: str
    program: Optional[str] = None  # Добавили программу
    price: float
    duration: int
    start_date: date
    end_date: date
    country: str
    city: str
    max_people: int

class TourCreate(TourBase):
    image_base64: Optional[str] = None
    image_type: Optional[str] = None

class Tour(TourBase):
    id: int
    image_data: Optional[str] = None
    image_type: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
