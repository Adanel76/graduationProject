from sqlalchemy import Column, Integer, String, Text, DECIMAL, DATE, TIMESTAMP, ForeignKey, LargeBinary, Boolean
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    role = Column(String(50), default="client")
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String(10))
    verification_code_expires = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Tour(Base):
    __tablename__ = "tours"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    program = Column(Text)  # Добавили программу тура
    price = Column(DECIMAL(10, 2))
    duration = Column(Integer)
    start_date = Column(DATE)
    end_date = Column(DATE)
    country = Column(String(100))
    city = Column(String(100))
    image_data = Column(LargeBinary)
    image_type = Column(String(50))
    max_people = Column(Integer)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tour_id = Column(Integer, ForeignKey("tours.id"))
    booking_date = Column(TIMESTAMP, server_default=func.now())
    status = Column(String(50), default="pending")
    people_count = Column(Integer)

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tour_id = Column(Integer, ForeignKey("tours.id"))
    rating = Column(Integer)
    comment = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

# Новая таблица для логов
class UserLog(Base):
    __tablename__ = "user_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(255))
    description = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(TIMESTAMP, server_default=func.now())
