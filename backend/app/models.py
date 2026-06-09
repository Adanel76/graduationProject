from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    Boolean,
    DateTime,
    Text,
    Numeric,
    LargeBinary,
    Date,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text)
    content = Column(Text, nullable=False)

    event_type = Column(String(50), nullable=False)   # news, promo, webinar, update
    format_type = Column(String(50), nullable=True)   # online, offline, info

    country = Column(String(100))
    city = Column(String(100))

    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    image_url = Column(Text, nullable=True)
    image_data = Column(LargeBinary, nullable=True)
    image_type = Column(String(50), nullable=True)

    is_featured = Column(Boolean, default=False)
    is_published = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="client")
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    avatar_data = Column(Text, nullable=True)
    avatar_type = Column(String(80), nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String(10))
    verification_code_expires = Column(DateTime)

    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    logs = relationship("UserLog", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship("UserLoginHistory", back_populates="user", cascade="all, delete-orphan")
    promo_usage = relationship("UserPromoUsage", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    analytics_events = relationship("AnalyticsEvent", back_populates="user", cascade="all, delete-orphan")
    tour_preferences = relationship("UserTourPreference", back_populates="user", cascade="all, delete-orphan")
    rating_profile = relationship("UserRating", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notification_settings = relationship(
        "UserNotificationSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    custom_tour_plans = relationship(
        "CustomTourPlan",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(10), unique=True)
    description = Column(Text)
    currency = Column(String(10))
    language = Column(String(50))
    timezone = Column(String(50))
    visa_required = Column(Boolean, default=True)
    rating = Column(Numeric(3, 2), default=0.0)
    image_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    resorts = relationship("Resort", back_populates="country")
    tours = relationship("Tour", back_populates="country_ref")


class Resort(Base):
    __tablename__ = "resorts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    country_id = Column(Integer, ForeignKey("countries.id"))
    description = Column(Text)
    beach_type = Column(String(100))
    water_temperature = Column(String(50))
    infrastructure = Column(Text)
    activities = Column(Text)
    rating = Column(Numeric(3, 2), default=0.0)
    image_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    country = relationship("Country", back_populates="resorts")
    tours = relationship("Tour", back_populates="resort")


class TourCategory(Base):
    __tablename__ = "tour_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    description = Column(Text)
    icon = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    tour_links = relationship("TourCategoryLink", back_populates="category", cascade="all, delete-orphan")


class TourCategoryLink(Base):
    __tablename__ = "tour_category_links"

    id = Column(Integer, primary_key=True, index=True)
    tour_id = Column(Integer, ForeignKey("tours.id"))
    category_id = Column(Integer, ForeignKey("tour_categories.id"))

    tour = relationship("Tour", back_populates="category_links")
    category = relationship("TourCategory", back_populates="tour_links")


class Tour(Base):
    __tablename__ = "tours"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    duration = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Старые поля оставляем для совместимости
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)

    image_url = Column(Text)
    max_people = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    image_data = Column(LargeBinary)
    image_type = Column(String(50))
    program = Column(Text)
    accommodation = Column(Text)
    meals = Column(Text)
    meals_features = Column(Text)
    activities = Column(Text)
    activities_features = Column(Text)
    resort_info = Column(Text)
    resort_features = Column(Text)
    program_details = Column(Text)
    hotel_name = Column(String(255))
    hotel_address = Column(Text)
    hotel_description = Column(Text)
    hotel_features = Column(Text)
    hotel_map_lat = Column(Float, nullable=True)
    hotel_map_lng = Column(Float, nullable=True)
    hotel_map_zoom = Column(Integer, default=15)
    map_lat = Column(Float, nullable=True)
    map_lng = Column(Float, nullable=True)
    map_zoom = Column(Integer, default=12)
    rating = Column(Numeric(3, 2), default=0.0)
    review_count = Column(Integer, default=0)
    country_id = Column(Integer, ForeignKey("countries.id"))
    resort_id = Column(Integer, ForeignKey("resorts.id"))

    country_ref = relationship("Country", back_populates="tours")
    resort = relationship("Resort", back_populates="tours")

    bookings = relationship("Booking", back_populates="tour", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="tour", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="tour", cascade="all, delete-orphan")
    category_links = relationship("TourCategoryLink", back_populates="tour", cascade="all, delete-orphan")
    preferences = relationship("UserTourPreference", back_populates="tour", cascade="all, delete-orphan")
    gallery_images = relationship(
        "TourImage",
        back_populates="tour",
        cascade="all, delete-orphan",
        order_by="TourImage.sort_order",
    )


class TourImage(Base):
    __tablename__ = "tour_images"

    id = Column(Integer, primary_key=True, index=True)
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(Text, nullable=True)
    image_data = Column(LargeBinary, nullable=True)
    image_type = Column(String(50), nullable=True)
    alt_text = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    tour = relationship("Tour", back_populates="gallery_images")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(String(20))
    discount_value = Column(Numeric(10, 2), nullable=False)
    max_uses = Column(Integer)
    used_count = Column(Integer, default=0)
    valid_from = Column(DateTime)
    valid_until = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    bookings = relationship("Booking", back_populates="promo_code")
    usages = relationship("UserPromoUsage", back_populates="promo_code", cascade="all, delete-orphan")


class BookingStatus(Base):
    __tablename__ = "booking_statuses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)

    bookings = relationship("Booking", back_populates="status_ref")
    old_history_entries = relationship(
        "BookingStatusHistory",
        foreign_keys="BookingStatusHistory.old_status_id",
        back_populates="old_status",
    )
    new_history_entries = relationship(
        "BookingStatusHistory",
        foreign_keys="BookingStatusHistory.new_status_id",
        back_populates="new_status",
    )


class PaymentStatus(Base):
    __tablename__ = "payment_statuses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)

    bookings = relationship("Booking", back_populates="payment_status_ref")
    payments = relationship("Payment", back_populates="payment_status")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)

    bookings = relationship("Booking", back_populates="payment_method_ref")
    payments = relationship("Payment", back_populates="payment_method")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="CASCADE"))
    booking_date = Column(DateTime, server_default=func.now())

    # Старые поля оставляем для совместимости
    status = Column(String(50), default="pending")
    people_count = Column(Integer, nullable=False)
    total_price = Column(Numeric(10, 2))
    discount_amount = Column(Numeric(10, 2), default=0)
    payment_status = Column(String(50), default="pending")
    payment_method = Column(String(50))
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"))

    # Новые нормализованные поля
    status_id = Column(Integer, ForeignKey("booking_statuses.id"))
    payment_status_id = Column(Integer, ForeignKey("payment_statuses.id"))
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))

    user = relationship("User", back_populates="bookings")
    tour = relationship("Tour", back_populates="bookings")
    promo_code = relationship("PromoCode", back_populates="bookings")

    status_ref = relationship("BookingStatus", back_populates="bookings")
    payment_status_ref = relationship("PaymentStatus", back_populates="bookings")
    payment_method_ref = relationship("PaymentMethod", back_populates="bookings")

    history_entries = relationship("BookingStatusHistory", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")


class CustomTourPlan(Base):
    __tablename__ = "custom_tour_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False)
    people_count = Column(Integer, nullable=False)
    budget = Column(Numeric(12, 2), nullable=True)
    pace = Column(String(30), nullable=False, default="balanced")
    interest = Column(String(50), nullable=False, default="culture")
    package_type = Column(String(30), nullable=False, default="comfort")
    services_json = Column(Text, nullable=False)
    route_json = Column(Text, nullable=False)
    activities_json = Column(Text, nullable=False)
    program_json = Column(Text, nullable=False)
    special_requests = Column(Text, nullable=True)
    base_price = Column(Numeric(12, 2), nullable=False, default=0)
    services_price = Column(Numeric(12, 2), nullable=False, default=0)
    estimated_total = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="draft", index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="custom_tour_plans")


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    old_status_id = Column(Integer, ForeignKey("booking_statuses.id"))
    new_status_id = Column(Integer, ForeignKey("booking_statuses.id"))
    changed_by_user_id = Column(Integer, ForeignKey("users.id"))
    note = Column(Text)
    changed_at = Column(DateTime, server_default=func.now())

    booking = relationship("Booking", back_populates="history_entries")
    old_status = relationship("BookingStatus", foreign_keys=[old_status_id], back_populates="old_history_entries")
    new_status = relationship("BookingStatus", foreign_keys=[new_status_id], back_populates="new_history_entries")
    changed_by_user = relationship("User")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))
    payment_status_id = Column(Integer, ForeignKey("payment_statuses.id"))
    amount = Column(Numeric(10, 2), nullable=False)
    paid_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    booking = relationship("Booking", back_populates="payments")
    payment_method = relationship("PaymentMethod", back_populates="payments")
    payment_status = relationship("PaymentStatus", back_populates="payments")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="CASCADE"))
    rating = Column(Integer)
    comment = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="reviews")
    tour = relationship("Tour", back_populates="reviews")


class NotificationType(Base):
    __tablename__ = "notification_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    read_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="notifications")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tour_id = Column(Integer, ForeignKey("tours.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="favorites")
    tour = relationship("Tour", back_populates="favorites")


class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    email_booking_confirmation = Column(Boolean, default=True)
    email_booking_updates = Column(Boolean, default=True)
    email_newsletter = Column(Boolean, default=False)
    email_promotions = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="notification_settings")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_type = Column(String(100))
    event_data = Column(Text)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="analytics_events")


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_type = Column(String(50))
    title = Column(String(100))
    description = Column(Text)
    icon = Column(String(100))
    earned_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="achievements")


class UserLoginHistory(Base):
    __tablename__ = "user_login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    login_time = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="login_history")


class UserLog(Base):
    __tablename__ = "user_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    action = Column(String(255), nullable=False)
    description = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="logs")


class UserPromoUsage(Base):
    __tablename__ = "user_promo_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"))
    used_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="promo_usage")
    promo_code = relationship("PromoCode", back_populates="usages")


class UserRating(Base):
    __tablename__ = "user_ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total_bookings = Column(Integer, default=0)
    total_spent = Column(Numeric(12, 2), default=0)
    average_rating = Column(Numeric(3, 2), default=0)
    rating_level = Column(String(20))
    points = Column(Integer, default=0)
    last_updated = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="rating_profile")


class UserTourPreference(Base):
    __tablename__ = "user_tour_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tour_id = Column(Integer, ForeignKey("tours.id"))
    preference_score = Column(Integer)
    viewed_at = Column(DateTime)
    booked_at = Column(DateTime)

    user = relationship("User", back_populates="tour_preferences")
    tour = relationship("Tour", back_populates="preferences")
